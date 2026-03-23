// Uniform structured logging using syslog severity levels 0–7.
// Reference: operability.uniform_logging_with_syslog_severity_0_to_7
import { SyslogSeverity } from './severity.js';
import { redactSensitiveFields } from './redaction.js';

type LogMetadata = Record<string, unknown>;

interface LogEntry {
  timestamp: string;
  severity: number;
  service: string;
  request_id: string;
  user_id?: unknown;
  action: string;
  message: string;
  metadata?: LogMetadata;
}

function writeLog(
  severity: SyslogSeverity,
  service: string,
  action: string,
  message: string,
  metadata?: LogMetadata,
): void {
  const redacted = metadata ? redactSensitiveFields(metadata) : undefined;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    severity,
    service,
    request_id: (metadata?.['request_id'] as string | undefined) ?? 'none',
    ...(metadata?.['user_id'] !== undefined && { user_id: metadata['user_id'] }),
    action,
    message,
    ...(redacted !== undefined && { metadata: redacted }),
  };

  console.log(JSON.stringify(entry));
}

export interface Logger {
  emergency(action: string, message: string, metadata?: LogMetadata): void;
  alert(action: string, message: string, metadata?: LogMetadata): void;
  critical(action: string, message: string, metadata?: LogMetadata): void;
  error(action: string, message: string, metadata?: LogMetadata): void;
  warning(action: string, message: string, metadata?: LogMetadata): void;
  notice(action: string, message: string, metadata?: LogMetadata): void;
  info(action: string, message: string, metadata?: LogMetadata): void;
  debug(action: string, message: string, metadata?: LogMetadata): void;
}

/**
 * Creates a structured JSON logger bound to the given service name.
 * All output goes to stdout so that log aggregators can ingest it uniformly.
 */
export function createLogger(service: string): Logger {
  return {
    emergency: (action, message, metadata) =>
      writeLog(SyslogSeverity.EMERGENCY, service, action, message, metadata),
    alert: (action, message, metadata) =>
      writeLog(SyslogSeverity.ALERT, service, action, message, metadata),
    critical: (action, message, metadata) =>
      writeLog(SyslogSeverity.CRITICAL, service, action, message, metadata),
    error: (action, message, metadata) =>
      writeLog(SyslogSeverity.ERROR, service, action, message, metadata),
    warning: (action, message, metadata) =>
      writeLog(SyslogSeverity.WARNING, service, action, message, metadata),
    notice: (action, message, metadata) =>
      writeLog(SyslogSeverity.NOTICE, service, action, message, metadata),
    info: (action, message, metadata) =>
      writeLog(SyslogSeverity.INFORMATIONAL, service, action, message, metadata),
    debug: (action, message, metadata) =>
      writeLog(SyslogSeverity.DEBUG, service, action, message, metadata),
  };
}

export { SyslogSeverity, severityLabel } from './severity.js';
export { redactSensitiveFields } from './redaction.js';
