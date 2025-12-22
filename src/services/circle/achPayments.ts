import 'server-only';

/**
 * Circle ACH Payment Service
 *
 * Handles ACH payment processing for loan repayments via Circle's API.
 *
 * Architecture:
 * Borrower Bank Account
 *   ↓ (Plaid Processor Token - links account)
 * Circle ACH API
 *   ↓ (ACH Pull - moves USD, 3-5 business days)
 * Circle Settlement (Circle's liquidity - NOT ours)
 *   ↓ (Converts to USDC automatically)
 * Circle Treasury Wallet (Circle-managed, API-controlled)
 *   ↓ (Circle Webhook triggers our backend)
 * CreditTreasuryPool.repayLoan()
 *
 * Environment Variables Required:
 * - CIRCLE_API_KEY: Circle API key
 * - CIRCLE_ENVIRONMENT: 'sandbox' or 'production'
 */

// Circle API base URLs
const CIRCLE_BASE_URLS = {
  sandbox: 'https://api-sandbox.circle.com/v1',
  production: 'https://api.circle.com/v1',
} as const;

interface CirclePaymentRequest {
  loanId: string;
  amount: number; // In USD (will be converted to cents)
  plaidProcessorToken: string;
  borrowerAddress: string;
  metadata?: Record<string, string>;
}

interface CirclePaymentResponse {
  success: boolean;
  paymentId?: string;
  status?: string;
  error?: string;
}

interface CirclePaymentStatus {
  id: string;
  status: 'pending' | 'confirmed' | 'paid' | 'failed';
  amount: {
    amount: string;
    currency: string;
  };
  createDate: string;
  updateDate: string;
  metadata?: Record<string, string>;
}

function getCircleConfig() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const environment = (process.env.CIRCLE_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';

  if (!apiKey) {
    throw new Error('CIRCLE_API_KEY environment variable is not set');
  }

  return {
    apiKey,
    baseUrl: CIRCLE_BASE_URLS[environment],
    environment,
  };
}

/**
 * Initiates an ACH payment for loan repayment
 *
 * @param request Payment request details
 * @returns Payment initiation result
 */
export async function initiateACHRepayment(
  request: CirclePaymentRequest
): Promise<CirclePaymentResponse> {
  try {
    const config = getCircleConfig();

    // Convert amount to cents (Circle expects amount as string with decimal)
    const amountInCents = (request.amount * 100).toFixed(0);
    const amountString = (Number(amountInCents) / 100).toFixed(2);

    console.log('[Circle ACH] Initiating payment', {
      loanId: request.loanId,
      amount: amountString,
      environment: config.environment,
    });

    const response = await fetch(`${config.baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        idempotencyKey: `loan-repayment-${request.loanId}-${Date.now()}`,
        amount: {
          amount: amountString,
          currency: 'USD',
        },
        source: {
          type: 'ach',
          id: request.plaidProcessorToken, // Plaid processor token for linked bank account
        },
        description: `Loan repayment for ${request.loanId}`,
        metadata: {
          loanId: request.loanId,
          borrowerAddress: request.borrowerAddress,
          ...request.metadata,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Circle ACH] Payment initiation failed', data);
      return {
        success: false,
        error: data.message || 'Payment initiation failed',
      };
    }

    console.log('[Circle ACH] Payment initiated successfully', {
      paymentId: data.data.id,
      status: data.data.status,
    });

    return {
      success: true,
      paymentId: data.data.id,
      status: data.data.status,
    };
  } catch (error) {
    console.error('[Circle ACH] Error initiating payment', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Gets the status of a Circle payment
 *
 * @param paymentId Circle payment ID
 * @returns Payment status
 */
export async function getPaymentStatus(paymentId: string): Promise<CirclePaymentStatus | null> {
  try {
    const config = getCircleConfig();

    const response = await fetch(`${config.baseUrl}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      console.error('[Circle ACH] Failed to get payment status', await response.json());
      return null;
    }

    const data = await response.json();
    return data.data as CirclePaymentStatus;
  } catch (error) {
    console.error('[Circle ACH] Error getting payment status', error);
    return null;
  }
}

/**
 * Creates a Plaid processor token for Circle ACH
 *
 * This function should be called after Plaid Link to create a processor token
 * that can be used with Circle's ACH API.
 *
 * @param accessToken Plaid access token
 * @param accountId Plaid account ID
 * @returns Processor token for Circle
 */
export async function createPlaidProcessorToken(
  accessToken: string,
  accountId: string
): Promise<string | null> {
  try {
    const plaidClientId = process.env.PLAID_CLIENT_ID;
    const plaidSecret = process.env.PLAID_SECRET;
    const plaidEnv = process.env.NEXT_PUBLIC_PLAID_ENV || 'sandbox';

    if (!plaidClientId || !plaidSecret) {
      throw new Error('Plaid credentials not configured');
    }

    const plaidBaseUrl =
      plaidEnv === 'production'
        ? 'https://production.plaid.com'
        : plaidEnv === 'development'
          ? 'https://development.plaid.com'
          : 'https://sandbox.plaid.com';

    const response = await fetch(`${plaidBaseUrl}/processor/token/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: plaidClientId,
        secret: plaidSecret,
        access_token: accessToken,
        account_id: accountId,
        processor: 'circle',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Plaid] Failed to create processor token', data);
      return null;
    }

    return data.processor_token;
  } catch (error) {
    console.error('[Plaid] Error creating processor token', error);
    return null;
  }
}

/**
 * Verifies Circle webhook signature
 *
 * @param payload Raw request body as string
 * @param signature Circle-Signature header value
 * @returns Whether the signature is valid
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const webhookSecret = process.env.CIRCLE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Circle Webhook] CIRCLE_WEBHOOK_SECRET not configured');
    return false;
  }

  // Circle uses HMAC-SHA256 for webhook signatures
  const crypto = require('crypto');
  const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

export type { CirclePaymentRequest, CirclePaymentResponse, CirclePaymentStatus };
