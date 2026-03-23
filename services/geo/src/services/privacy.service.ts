/**
 * Geolocation privacy controls
 * Per security.no_sensitive_data_in_logs
 *
 * Mitigates R11: Geolocation privacy concerns
 *
 * Rules:
 * 1. Location is session-only by default — not persisted without explicit consent
 * 2. No background location tracking
 * 3. Location data never shared with vendors or third parties
 * 4. Location fields redacted from logs (lat/lng never logged at full precision)
 * 5. Users can delete saved locations at any time
 */

export interface LocationConsent {
  sessionOnly: boolean;      // true = don't persist
  saveToProfile: boolean;    // user explicitly opted in
  consentedAt?: string;      // ISO timestamp of consent
}

/**
 * Reduce precision of coordinates for logging purposes.
 * Full precision (6 decimals) = ~0.1m accuracy — too precise for logs.
 * 2 decimals = ~1.1km accuracy — safe for debugging without PII risk.
 */
export function redactLocationForLog(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Math.round(lat * 100) / 100,
    lng: Math.round(lng * 100) / 100,
  };
}

/**
 * Validate that location data should be persisted based on consent.
 * Returns false if user hasn't explicitly opted in to saving location.
 */
export function canPersistLocation(consent: LocationConsent): boolean {
  return consent.saveToProfile === true && !consent.sessionOnly;
}

/**
 * Default consent state for new sessions — session-only, no persistence.
 */
export function defaultLocationConsent(): LocationConsent {
  return {
    sessionOnly: true,
    saveToProfile: false,
  };
}
