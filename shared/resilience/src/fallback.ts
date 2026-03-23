/**
 * Fallback pattern — try primary, fall back to secondary
 * Per reliability.timeouts_retries_and_circuit_breakers
 *
 * Mitigates:
 * - R5: ES failure → fallback to PostgreSQL full-text search
 * - R9: Redis failure → fallback to direct DB queries
 */

export interface FallbackOptions {
  name: string;
  timeoutMs?: number;  // timeout for primary (default: 5000)
  onFallback?: (name: string, error: unknown) => void; // callback when fallback used
}

/** Wraps a promise with a timeout. Rejects if not resolved within timeoutMs. */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function withFallback<T>(
  primary: () => Promise<T>,
  secondary: () => Promise<T>,
  options?: FallbackOptions,
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 5000;

  try {
    return await withTimeout(primary(), timeoutMs);
  } catch (primaryError) {
    options?.onFallback?.(options.name, primaryError);
    return await secondary();
  }
}
