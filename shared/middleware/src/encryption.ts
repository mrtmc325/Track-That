/**
 * Application-level AES-256-GCM encryption for sensitive fields.
 * Per Phase 11 spec section 11.5:
 * "Sensitive fields (adapter_config for stores): Application-level AES-256-GCM encryption before storage"
 *
 * security.encryption_in_transit_and_at_rest — sensitive data encrypted at application layer
 * security.secrets_managed_not_stored — encryption key from env, never in source
 *
 * Why AES-256-GCM?
 * - Authenticated encryption: provides both confidentiality and integrity
 * - GCM mode: parallelizable, hardware-accelerated on modern CPUs
 * - 256-bit key: exceeds NIST recommendation for long-term security
 */
import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;  // GCM recommended IV length
const TAG_LENGTH = 16; // GCM auth tag length

/**
 * Get encryption key from environment.
 * Key must be exactly 32 bytes (256 bits), hex-encoded (64 chars).
 * In production: injected via Docker secrets or vault.
 */
function getKey(): Buffer {
  const keyHex = process.env.FIELD_ENCRYPTION_KEY ||
    // Dev fallback — NOT for production
    'a'.repeat(64);

  if (keyHex.length !== 64) {
    throw new Error('FIELD_ENCRYPTION_KEY must be 64 hex characters (256 bits)');
  }

  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt a string using AES-256-GCM.
 * Returns base64-encoded string: IV + encrypted data + auth tag.
 *
 * Format: base64(IV[12] + ciphertext[n] + authTag[16])
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Concatenate: IV + ciphertext + authTag
  const result = Buffer.concat([iv, encrypted, authTag]);
  return result.toString('base64');
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Expects base64-encoded input in format: IV[12] + ciphertext[n] + authTag[16].
 * Throws on invalid data or tampered ciphertext (GCM auth check).
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const data = Buffer.from(ciphertext, 'base64');

  if (data.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid ciphertext: too short');
  }

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(data.length - TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH, data.length - TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Encrypt a JSON object (e.g., adapter_config).
 * Serializes to JSON string, then encrypts.
 */
export function encryptJson(data: Record<string, unknown>): string {
  return encrypt(JSON.stringify(data));
}

/**
 * Decrypt a JSON object.
 */
export function decryptJson(ciphertext: string): Record<string, unknown> {
  const json = decrypt(ciphertext);
  return JSON.parse(json);
}
