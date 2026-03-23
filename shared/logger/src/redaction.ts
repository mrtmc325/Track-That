/**
 * Redaction utilities for structured log output.
 *
 * WHY THIS EXISTS:
 * Logging sensitive data (passwords, tokens, PII) violates regulatory
 * requirements (GDPR, PCI-DSS, HIPAA) and creates serious security exposure
 * if logs are forwarded to third-party aggregators or accessed by unauthorized
 * parties. This module ensures compliance.no_sensitive_data_in_logs by
 * stripping sensitive fields before any log entry is written.
 *
 * References: compliance, security.no_sensitive_data_in_logs
 */

const SENSITIVE_KEYS: readonly string[] = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'credit_card',
  'card_number',
  'cvv',
  'ssn',
  'email',
];

/**
 * Deep-clones `obj` and replaces the value of any key whose name
 * (case-insensitive) contains a sensitive substring with '[REDACTED]'.
 *
 * Nested objects are traversed recursively so that sensitive fields cannot
 * be hidden inside a sub-object.
 */
export function redactSensitiveFields(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const clone = structuredClone(obj);
  return redactObject(clone);
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some((sensitive) =>
      lowerKey.includes(sensitive),
    );

    if (isSensitive) {
      obj[key] = '[REDACTED]';
    } else if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      obj[key] = redactObject(obj[key] as Record<string, unknown>);
    }
  }
  return obj;
}
