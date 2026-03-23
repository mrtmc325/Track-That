// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

// Uniform structured logging per operability.uniform_logging_with_syslog_severity_0_to_7
const SENSITIVE_KEYS = ['password', 'token', 'secret', 'authorization', 'cookie', 'card'];

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...obj };
  for (const key of Object.keys(cleaned)) {
    if (SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s))) {
      cleaned[key] = '[REDACTED]';
    }
  }
  return cleaned;
}

function log(severity: number, action: string, message: string, meta?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    severity,
    service: 'ads-ingestion-service',
    request_id: meta?.request_id || 'none',
    ...(meta?.user_id ? { user_id: meta.user_id } : {}),
    action,
    message,
    ...(meta ? { metadata: redact(meta) } : {}),
  };
  console.log(JSON.stringify(entry));
}

export const logger = {
  emergency: (a: string, m: string, meta?: Record<string, unknown>) => log(0, a, m, meta),
  alert:     (a: string, m: string, meta?: Record<string, unknown>) => log(1, a, m, meta),
  critical:  (a: string, m: string, meta?: Record<string, unknown>) => log(2, a, m, meta),
  error:     (a: string, m: string, meta?: Record<string, unknown>) => log(3, a, m, meta),
  warning:   (a: string, m: string, meta?: Record<string, unknown>) => log(4, a, m, meta),
  notice:    (a: string, m: string, meta?: Record<string, unknown>) => log(5, a, m, meta),
  info:      (a: string, m: string, meta?: Record<string, unknown>) => log(6, a, m, meta),
  debug:     (a: string, m: string, meta?: Record<string, unknown>) => log(7, a, m, meta),
};
