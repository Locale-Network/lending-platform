import { NextRequest, NextResponse } from 'next/server';
import { PlaidApi, Configuration, PlaidEnvironments } from 'plaid';
import { handlePlaidWebhook, PlaidWebhookPayload } from '@/services/plaid/webhooks';
import * as jose from 'jose';
import { webhookLogger } from '@/lib/logger';
import { checkAndMarkWebhook } from '@/lib/webhook-dedup';

const log = webhookLogger.child({ provider: 'plaid' });

// Initialize Plaid client
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(plaidConfig);

// Cache for Plaid verification keys (they rotate infrequently)
type CryptoKey = Awaited<ReturnType<typeof jose.importJWK>>;
const keyCache = new Map<string, { key: CryptoKey; expiresAt: number }>();
const KEY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get Plaid verification key from cache or fetch from API
 */
async function getPlaidVerificationKey(keyId: string): Promise<CryptoKey | null> {
  // Check cache first
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

    // Import the JWK
    const key = await jose.importJWK(keyData as jose.JWK, 'ES256');

    // Cache the key
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
 * Verify Plaid webhook signature using full JWT verification
 *
 * Plaid webhooks are signed JWTs. The verification header contains:
 * - JWT signed with ES256 algorithm
 * - Key ID in the JWT header for key lookup
 *
 * @param body - Raw request body as string
 * @param jwtToken - Plaid-Verification header value (the JWT)
 * @returns True if the webhook is valid
 */
async function verifyPlaidWebhook(
  body: string,
  jwtToken: string | null
): Promise<boolean> {
  if (!jwtToken) {
    log.error('No verification header present');
    return false;
  }

  try {
    // Decode the JWT header to get the key ID
    const protectedHeader = jose.decodeProtectedHeader(jwtToken);
    const keyId = protectedHeader.kid;

    if (!keyId) {
      log.error('No key ID in JWT header');
      return false;
    }

    // Get the verification key
    const key = await getPlaidVerificationKey(keyId);
    if (!key) {
      log.error('Could not get verification key');
      return false;
    }

    // Verify the JWT signature and claims
    const { payload } = await jose.jwtVerify(jwtToken, key, {
      algorithms: ['ES256'],
      // Plaid JWTs are valid for 5 minutes
      maxTokenAge: '5m',
    });

    // Verify the request body matches the JWT claim
    // Plaid includes a hash of the body in the 'request_body_sha256' claim
    const bodyHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(body)
    );
    const bodyHashBase64 = Buffer.from(bodyHash).toString('base64');

    if (payload.request_body_sha256 !== bodyHashBase64) {
      log.error('Body hash mismatch');
      return false;
    }

    log.info('Signature verified successfully');
    return true;
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      log.error('JWT expired');
    } else if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
      log.error('JWT signature verification failed');
    } else {
      log.error({ err: error }, 'Verification failed');
    }
    return false;
  }
}

/**
 * Plaid Webhook Endpoint
 *
 * Receives webhooks from Plaid when:
 * - Item access is revoked (USER_PERMISSION_REVOKED)
 * - Item requires re-authentication (ITEM_LOGIN_REQUIRED)
 * - Access token is expiring (PENDING_EXPIRATION)
 * - Transaction sync updates are available (SYNC_UPDATES_AVAILABLE)
 *
 * This endpoint handles Plaid Item disconnection events,
 * ensuring stale data cannot be used for DSCR calculations.
 *
 * Security:
 * - Plaid sends webhooks with a verification header
 * - Webhook signature is verified using Plaid's verification endpoint
 * - Consider rate limiting and IP allowlisting for production
 */

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const verificationHeader = request.headers.get('plaid-verification');

    // Verify webhook signature
    const isValid = await verifyPlaidWebhook(rawBody, verificationHeader);
    if (!isValid) {
      log.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // Parse the webhook payload
    const payload: PlaidWebhookPayload = JSON.parse(rawBody);

    // Validate required fields
    if (!payload.webhook_type || !payload.webhook_code || !payload.item_id) {
      log.error('Invalid payload - missing required fields');
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      );
    }

    // Check for replay attack - skip if already processed
    // Use item_id + webhook_type + webhook_code as unique identifier
    const webhookId = `${payload.item_id}:${payload.webhook_type}:${payload.webhook_code}`;
    const { isNew } = await checkAndMarkWebhook(webhookId, 'plaid');
    if (!isNew) {
      log.info({ webhookId }, 'Duplicate webhook - already processed');
      return NextResponse.json({ success: true, duplicate: true });
    }

    // Process the webhook
    const result = await handlePlaidWebhook(payload);

    log.info({ action: result.action, message: result.message }, 'Webhook processed');

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    log.error({ err: error }, 'Error processing webhook');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Plaid may send GET requests for webhook verification
export async function GET() {
  return NextResponse.json(
    { status: 'Plaid webhook endpoint active' },
    { status: 200 }
  );
}
