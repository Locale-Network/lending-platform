import { NextRequest, NextResponse } from 'next/server';
import { handlePlaidWebhook, PlaidWebhookPayload } from '@/services/plaid/webhooks';
import { webhookLogger } from '@/lib/logger';
import { checkAndMarkWebhook } from '@/lib/webhook-dedup';
import { verifyPlaidWebhook } from '@/lib/plaid-webhook-verify';

const log = webhookLogger.child({ provider: 'plaid' });

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

    // SECURITY: Parse the webhook payload with explicit error handling
    // Malformed JSON should return 400, not trigger an unhandled exception
    let payload: PlaidWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      log.error({ err: parseError }, 'Invalid JSON in webhook body');
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!payload || typeof payload !== 'object') {
      log.error('Payload is not an object');
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      );
    }

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
