import 'server-only';

import * as jose from 'jose';
import plaidClient from '@/utils/plaid';
import { logger } from './logger';

const log = logger.child({ module: 'plaid-webhook-verify' });

// Cache for Plaid verification keys (they rotate infrequently)
type CryptoKey = Awaited<ReturnType<typeof jose.importJWK>>;
const keyCache = new Map<string, { key: CryptoKey; expiresAt: number }>();
const KEY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function getPlaidVerificationKey(keyId: string): Promise<CryptoKey | null> {
  const cached = keyCache.get(keyId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key;
  }

  try {
    const response = await plaidClient.webhookVerificationKeyGet({ key_id: keyId });
    const keyData = response.data.key;

    if (!keyData) {
      log.error({ keyId }, 'No key returned for key_id');
      return null;
    }

    const key = await jose.importJWK(keyData as jose.JWK, 'ES256');

    keyCache.set(keyId, {
      key,
      expiresAt: Date.now() + KEY_CACHE_TTL_MS,
    });

    return key;
  } catch (error) {
    log.error({ err: error }, 'Failed to fetch verification key');
    return null;
  }
}

/**
 * Verify Plaid webhook JWT signature.
 *
 * Plaid signs every webhook with an ES256 JWT containing a SHA-256 hash
 * of the request body. This function verifies the signature and body hash.
 *
 * @param body - Raw request body string
 * @param jwtToken - Value of the Plaid-Verification header
 * @returns true if valid
 */
export async function verifyPlaidWebhook(
  body: string,
  jwtToken: string | null
): Promise<boolean> {
  if (!jwtToken) {
    log.error('No Plaid-Verification header');
    return false;
  }

  try {
    const protectedHeader = jose.decodeProtectedHeader(jwtToken);
    const keyId = protectedHeader.kid;

    if (!keyId) {
      log.error('No key ID in JWT header');
      return false;
    }

    const key = await getPlaidVerificationKey(keyId);
    if (!key) {
      return false;
    }

    const { payload } = await jose.jwtVerify(jwtToken, key, {
      algorithms: ['ES256'],
      maxTokenAge: '5m',
    });

    // Verify request body hash
    const bodyHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(body)
    );
    const bodyHashBase64 = Buffer.from(bodyHash).toString('base64');

    if (payload.request_body_sha256 !== bodyHashBase64) {
      log.error('Body hash mismatch');
      return false;
    }

    return true;
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      log.error('Plaid webhook JWT expired');
    } else if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
      log.error('Plaid webhook JWT signature invalid');
    } else {
      log.error({ err: error }, 'Plaid webhook verification failed');
    }
    return false;
  }
}
