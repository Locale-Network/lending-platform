/**
 * Database Field Encryption Utilities
 *
 * Provides AES-256-GCM encryption for sensitive database fields like:
 * - Plaid access tokens
 * - API keys stored in the database
 * - Other PII that needs encryption at rest
 *
 * Usage:
 *   const encrypted = encryptField(plaintext);
 *   const decrypted = decryptField(encrypted);
 *
 * Environment:
 *   DATABASE_ENCRYPTION_KEY - 32-byte hex key (64 hex chars)
 *   Generate with: openssl rand -hex 32
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { logger } from './logger';

// Algorithm: AES-256-GCM provides authenticated encryption
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 16; // For key derivation

// Version prefix for future algorithm migrations
const ENCRYPTION_VERSION = 'v1';

// Track if we've warned about development key to avoid spam
let devKeyWarned = false;

/**
 * Get the encryption key from environment
 * Uses scrypt to derive a proper key from the environment secret
 *
 * SECURITY: In development mode, a deterministic fallback key is used if
 * DATABASE_ENCRYPTION_KEY is not set. This key is known and insecure.
 * Always set a proper key in production.
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.DATABASE_ENCRYPTION_KEY;

  if (!envKey) {
    // In development, warn and use a deterministic key (NOT for production)
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      if (!devKeyWarned) {
        logger.warn(
          '⚠️  SECURITY WARNING: DATABASE_ENCRYPTION_KEY not set - using insecure development fallback. ' +
          'Generate a key with: openssl rand -hex 32'
        );
        devKeyWarned = true;
      }
      // Deterministic key for development only - DO NOT USE IN PRODUCTION
      return Buffer.from('0'.repeat(64), 'hex');
    }
    throw new Error(
      'DATABASE_ENCRYPTION_KEY environment variable is required for encryption. ' +
      'Generate with: openssl rand -hex 32'
    );
  }

  // Validate key format (should be 64 hex characters = 32 bytes)
  if (!/^[a-fA-F0-9]{64}$/.test(envKey)) {
    throw new Error(
      'DATABASE_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes). ' +
      'Generate with: openssl rand -hex 32'
    );
  }

  // SECURITY: Reject all-zero key in production (the development fallback)
  if (envKey === '0'.repeat(64) && process.env.NODE_ENV === 'production') {
    throw new Error(
      'DATABASE_ENCRYPTION_KEY cannot be the development fallback key in production. ' +
      'Generate a secure key with: openssl rand -hex 32'
    );
  }

  return Buffer.from(envKey, 'hex');
}

/**
 * Encrypt a sensitive field for database storage
 *
 * Format: v1:<salt>:<iv>:<authTag>:<ciphertext> (all base64)
 *
 * @param plaintext - The sensitive data to encrypt
 * @returns Encrypted string safe for database storage
 */
export function encryptField(plaintext: string): string {
  if (!plaintext) {
    return '';
  }

  try {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const salt = randomBytes(SALT_LENGTH);

    // Derive a unique key for this encryption using salt
    const derivedKey = scryptSync(key, salt, 32);

    const cipher = createCipheriv(ALGORITHM, derivedKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Combine all parts with version prefix for future migrations
    return [
      ENCRYPTION_VERSION,
      salt.toString('base64'),
      iv.toString('base64'),
      authTag.toString('base64'),
      ciphertext,
    ].join(':');
  } catch (error) {
    logger.error({ error }, 'Encryption failed');
    throw new Error('Failed to encrypt sensitive data');
  }
}

/**
 * Decrypt a sensitive field from database storage
 *
 * @param encryptedValue - The encrypted string from the database
 * @returns Decrypted plaintext
 */
export function decryptField(encryptedValue: string): string {
  if (!encryptedValue) {
    return '';
  }

  try {
    const parts = encryptedValue.split(':');

    if (parts.length !== 5) {
      // Not encrypted (legacy data) - return as-is
      // This allows gradual migration of existing data
      logger.warn('Found unencrypted legacy data in database');
      return encryptedValue;
    }

    const [version, saltB64, ivB64, authTagB64, ciphertext] = parts;

    if (version !== ENCRYPTION_VERSION) {
      throw new Error(`Unsupported encryption version: ${version}`);
    }

    const key = getEncryptionKey();
    const salt = Buffer.from(saltB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');

    // Derive the same key used for encryption
    const derivedKey = scryptSync(key, salt, 32);

    const decipher = createDecipheriv(ALGORITHM, derivedKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  } catch (error) {
    // Check if this is legacy unencrypted data
    if (!encryptedValue.startsWith(ENCRYPTION_VERSION)) {
      logger.warn('Attempting to decrypt legacy unencrypted data');
      return encryptedValue;
    }

    logger.error({ error }, 'Decryption failed');
    throw new Error('Failed to decrypt sensitive data');
  }
}

/**
 * Check if a value is encrypted (has our version prefix)
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  return value.startsWith(`${ENCRYPTION_VERSION}:`);
}

/**
 * Encrypt if not already encrypted (for migration)
 */
export function ensureEncrypted(value: string): string {
  if (!value) return '';
  if (isEncrypted(value)) return value;
  return encryptField(value);
}

/**
 * Rotate encryption to a new key
 * Used when DATABASE_ENCRYPTION_KEY needs to be changed
 *
 * @param encryptedValue - Value encrypted with old key
 * @param oldKey - The previous encryption key (hex)
 * @returns Value encrypted with current key
 */
export function rotateEncryption(
  encryptedValue: string,
  oldKey: string
): string {
  // Temporarily use old key to decrypt
  const originalEnvKey = process.env.DATABASE_ENCRYPTION_KEY;
  process.env.DATABASE_ENCRYPTION_KEY = oldKey;

  try {
    const plaintext = decryptField(encryptedValue);

    // Restore new key
    process.env.DATABASE_ENCRYPTION_KEY = originalEnvKey;

    // Re-encrypt with new key
    return encryptField(plaintext);
  } finally {
    // Ensure we restore the original key even on error
    process.env.DATABASE_ENCRYPTION_KEY = originalEnvKey;
  }
}

/**
 * Generate a new encryption key
 * For use in key generation scripts
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}
