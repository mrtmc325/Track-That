import { describe, it, expect } from 'vitest';
import { redactLocationForLog, canPersistLocation, defaultLocationConsent } from '../privacy.service.js';

describe('Geolocation Privacy (R11 mitigation)', () => {
  describe('redactLocationForLog', () => {
    it('reduces coordinate precision to 2 decimal places', () => {
      const result = redactLocationForLog(33.448376, -112.074036);
      expect(result.lat).toBe(33.45);
      expect(result.lng).toBe(-112.07);
    });

    it('preserves approximate area while removing precise location', () => {
      // Two locations 50m apart should map to the same redacted coords
      const a = redactLocationForLog(33.44837, -112.07403);
      const b = redactLocationForLog(33.44882, -112.07398);
      expect(a.lat).toBe(b.lat);
      expect(a.lng).toBe(b.lng);
    });
  });

  describe('canPersistLocation', () => {
    it('denies persistence by default', () => {
      expect(canPersistLocation(defaultLocationConsent())).toBe(false);
    });

    it('allows persistence when explicitly opted in', () => {
      expect(canPersistLocation({
        sessionOnly: false,
        saveToProfile: true,
        consentedAt: new Date().toISOString(),
      })).toBe(true);
    });

    it('denies persistence when sessionOnly is true even with saveToProfile', () => {
      expect(canPersistLocation({
        sessionOnly: true,
        saveToProfile: true,
      })).toBe(false);
    });
  });

  describe('defaultLocationConsent', () => {
    it('defaults to session-only with no persistence', () => {
      const consent = defaultLocationConsent();
      expect(consent.sessionOnly).toBe(true);
      expect(consent.saveToProfile).toBe(false);
      expect(consent.consentedAt).toBeUndefined();
    });
  });
});
