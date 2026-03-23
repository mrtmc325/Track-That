// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * Syslog severity levels per RFC 5424.
 * Using 0–7 ensures uniform log severity across all services.
 * Referenced by: operability.uniform_logging_with_syslog_severity_0_to_7
 */
export const enum SyslogSeverity {
  EMERGENCY     = 0,
  ALERT         = 1,
  CRITICAL      = 2,
  ERROR         = 3,
  WARNING       = 4,
  NOTICE        = 5,
  INFORMATIONAL = 6,
  DEBUG         = 7,
}

/** Human-readable labels for each syslog severity level. */
export const severityLabel: Record<number, string> = {
  [SyslogSeverity.EMERGENCY]:     'EMERGENCY',
  [SyslogSeverity.ALERT]:         'ALERT',
  [SyslogSeverity.CRITICAL]:      'CRITICAL',
  [SyslogSeverity.ERROR]:         'ERROR',
  [SyslogSeverity.WARNING]:       'WARNING',
  [SyslogSeverity.NOTICE]:        'NOTICE',
  [SyslogSeverity.INFORMATIONAL]: 'INFORMATIONAL',
  [SyslogSeverity.DEBUG]:         'DEBUG',
};
