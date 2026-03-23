import type { Express, Request, Response } from 'express';

export interface HealthCheck {
  name: string;
  check: () => Promise<boolean>;
}

interface CheckResult {
  name: string;
  healthy: boolean;
}

/**
 * Registers standard liveness and readiness endpoints on the given Express app.
 *
 * GET /healthz  — liveness probe.
 *   Always returns 200 { status: 'ok' } as long as the process is alive.
 *   Used by the container orchestrator to decide whether to restart the pod.
 *
 * GET /readyz   — readiness probe.
 *   Runs every supplied check (e.g. DB connectivity, cache reachability) in
 *   parallel. Returns 200 if all checks pass, 503 if any fail.
 *   Used by the load balancer to decide whether to route traffic to this pod.
 */
export function registerHealthChecks(
  app: Express,
  checks: HealthCheck[] = [],
): void {
  app.get('/healthz', (_req: Request, res: Response): void => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/readyz', async (_req: Request, res: Response): Promise<void> => {
    const results: CheckResult[] = await Promise.all(
      checks.map(async ({ name, check }) => {
        try {
          const healthy = await check();
          return { name, healthy };
        } catch {
          return { name, healthy: false };
        }
      }),
    );

    const allHealthy = results.every((r) => r.healthy);

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'ok' : 'degraded',
      checks: results,
    });
  });
}
