import 'server-only';
import prisma from '@prisma/index';

/**
 * Plaid Webhook Handler
 *
 * Handles Plaid webhooks for transaction sync and item status updates.
 * Uses zkFetch + Cartesi architecture for DSCR verification.
 */

/**
 * Plaid webhook payload structure
 */
export interface PlaidWebhookPayload {
  webhook_type: string;
  webhook_code: string;
  item_id: string;
  error?: {
    error_code: string;
    error_message: string;
    error_type: string;
  };
  new_transactions?: number;
  removed_transactions?: string[];
  consent_expiration_time?: string;
}

/**
 * Webhook processing result
 */
export interface WebhookResult {
  processed: boolean;
  action?: 'handled' | 'ignored';
  message: string;
  loanApplicationId?: string;
}

/**
 * Handle incoming Plaid webhook
 *
 * @param payload - The webhook payload from Plaid
 * @returns Result of webhook processing
 */
export async function handlePlaidWebhook(
  payload: PlaidWebhookPayload
): Promise<WebhookResult> {
  const { webhook_type, webhook_code, item_id } = payload;

  console.log(
    `[Plaid Webhook] Received: type=${webhook_type}, code=${webhook_code}, item=${item_id}`
  );

  // Handle ITEM webhooks
  if (webhook_type === 'ITEM') {
    return handleItemWebhook(payload);
  }

  // Handle TRANSACTIONS webhooks
  if (webhook_type === 'TRANSACTIONS') {
    return handleTransactionsWebhook(payload);
  }

  // Ignore other webhook types
  return {
    processed: true,
    action: 'ignored',
    message: `Webhook type ${webhook_type} not handled`,
  };
}

/**
 * Find loan application IDs associated with a Plaid item
 */
async function findLoansByPlaidItemId(itemId: string): Promise<string[]> {
  const plaidItems = await prisma.plaidItemAccessToken.findMany({
    where: { itemId: itemId },
    select: { loanApplicationId: true },
  });
  return plaidItems.map(item => item.loanApplicationId);
}

/**
 * Handle ITEM webhooks (login required, permission revoked, etc.)
 */
async function handleItemWebhook(
  payload: PlaidWebhookPayload
): Promise<WebhookResult> {
  const { webhook_code, item_id } = payload;

  // Find loan applications associated with this Plaid item via the relation
  const loanIds = await findLoansByPlaidItemId(item_id);

  if (loanIds.length === 0) {
    return {
      processed: true,
      action: 'ignored',
      message: 'No loan applications found for this Plaid Item',
    };
  }

  // Handle re-authentication required
  if (webhook_code === 'ITEM_LOGIN_REQUIRED' || webhook_code === 'PENDING_EXPIRATION') {
    console.log(
      `[Plaid Webhook] Login required for item ${item_id}, affects ${loanIds.length} loans`
    );

    // Log the event - actual re-auth handling would need UI flow
    console.log(`[Plaid Webhook] Loan IDs needing re-auth: ${loanIds.join(', ')}`);

    return {
      processed: true,
      action: 'handled',
      message: `Logged ${loanIds.length} loan(s) needing re-authentication`,
    };
  }

  // Handle user permission revoked
  if (webhook_code === 'USER_PERMISSION_REVOKED') {
    console.log(
      `[Plaid Webhook] Permission revoked for item ${item_id}`
    );

    // Delete the PlaidItemAccessToken records for this item
    await prisma.plaidItemAccessToken.deleteMany({
      where: { itemId: item_id },
    });

    // Clear the plaidAccessToken on affected loan applications
    await prisma.loanApplication.updateMany({
      where: { id: { in: loanIds } },
      data: { plaidAccessToken: null },
    });

    return {
      processed: true,
      action: 'handled',
      message: 'Cleared Plaid tokens due to permission revocation',
    };
  }

  return {
    processed: true,
    action: 'ignored',
    message: `Item webhook ${webhook_code} logged`,
  };
}

/**
 * Handle TRANSACTIONS webhooks
 */
async function handleTransactionsWebhook(
  payload: PlaidWebhookPayload
): Promise<WebhookResult> {
  const { webhook_code, item_id, new_transactions } = payload;

  // Log transaction sync events
  if (webhook_code === 'SYNC_UPDATES_AVAILABLE') {
    console.log(
      `[Plaid Webhook] Sync updates available for item ${item_id}: ${new_transactions} new transactions`
    );

    // Find associated loan applications via the relation
    const loanIds = await findLoansByPlaidItemId(item_id);

    if (loanIds.length > 0) {
      // Could trigger a transaction sync here if needed
      // For now, we rely on the scheduled daily sync or user-triggered sync
      return {
        processed: true,
        action: 'handled',
        message: `Transaction sync available for ${loanIds.length} loan(s)`,
        loanApplicationId: loanIds[0],
      };
    }
  }

  return {
    processed: true,
    action: 'ignored',
    message: `Transactions webhook ${webhook_code} logged`,
  };
}
