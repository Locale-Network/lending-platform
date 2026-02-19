import 'server-only';

import Stripe from 'stripe';
import prisma from '@prisma/index';

/**
 * Stripe ACH Payment Service
 *
 * Handles ACH payment processing for loan repayments via Stripe's ACH Direct Debit.
 *
 * Architecture:
 * Borrower Bank Account
 *   ↓ (Plaid Processor Token - links account)
 * Stripe ACH Direct Debit
 *   ↓ (ACH Pull - moves USD, 3-5 business days)
 * Stripe Settlement (USD stays as USD)
 *   ↓ (Stripe Webhook triggers our backend)
 * CreditTreasuryPool.repayLoan()
 *
 * Environment Variables Required:
 * - STRIPE_SECRET_KEY: Stripe API secret key
 * - STRIPE_WEBHOOK_SECRET: Stripe webhook signing secret
 */

// Initialize Stripe client
function getStripeClient(): Stripe {
  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }

  return new Stripe(apiKey);
}

function getStripeConfig() {
  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }

  const isLive = apiKey.startsWith('sk_live_');

  return {
    apiKey,
    environment: isLive ? ('live' as const) : ('test' as const),
  };
}

// ============================================================================
// Types
// ============================================================================

export interface StripePaymentRequest {
  loanId: string;
  amount: number; // In USD (dollars, not cents - function handles conversion)
  customerId: string;
  paymentMethodId: string;
  borrowerAddress: string;
  /** SECURITY: Required for ACH mandate compliance - must be actual customer IP */
  customerIpAddress: string;
  /** Optional: User agent string for mandate compliance */
  userAgent?: string;
  metadata?: Record<string, string>;
}

export interface StripePaymentResponse {
  success: boolean;
  paymentIntentId?: string;
  clientSecret?: string;
  status?: string;
  error?: string;
}

export interface StripePaymentStatus {
  id: string;
  status: Stripe.PaymentIntent.Status;
  amount: number; // In cents
  amountReceived: number; // In cents
  currency: string;
  createdAt: Date;
  metadata?: Record<string, string>;
}

// ============================================================================
// Customer Management
// ============================================================================

/**
 * Gets an existing Stripe customer or creates a new one for the borrower
 *
 * @param borrowerAddress The borrower's wallet address
 * @param email Optional email for the customer
 * @returns The Stripe customer ID
 */
export async function getOrCreateStripeCustomer(
  borrowerAddress: string,
  email?: string
): Promise<{ customerId: string; isNew: boolean }> {
  const normalizedAddress = borrowerAddress.toLowerCase();

  // Check if we already have a Stripe customer for this borrower
  const existingCustomer = await prisma.stripeCustomer.findUnique({
    where: { accountAddress: normalizedAddress },
  });

  if (existingCustomer) {
    return { customerId: existingCustomer.stripeCustomerId, isNew: false };
  }

  // Create a new Stripe customer
  const stripe = getStripeClient();

  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: {
      accountAddress: normalizedAddress,
      platform: 'locale-lending',
    },
  });

  // Store the mapping in our database
  await prisma.stripeCustomer.create({
    data: {
      stripeCustomerId: customer.id,
      accountAddress: normalizedAddress,
    },
  });

  console.log('[Stripe] Created new customer', {
    customerId: customer.id,
    borrowerAddress: normalizedAddress,
  });

  return { customerId: customer.id, isNew: true };
}

/**
 * Gets an existing Stripe customer by borrower address
 *
 * @param borrowerAddress The borrower's wallet address
 * @returns The Stripe customer ID or null if not found
 */
export async function getStripeCustomer(
  borrowerAddress: string
): Promise<string | null> {
  const normalizedAddress = borrowerAddress.toLowerCase();

  const customer = await prisma.stripeCustomer.findUnique({
    where: { accountAddress: normalizedAddress },
  });

  return customer?.stripeCustomerId || null;
}

// ============================================================================
// Plaid Processor Token (for Stripe)
// ============================================================================

/**
 * Creates a Plaid processor token for Stripe ACH
 *
 * This function should be called after Plaid Link to create a processor token
 * that can be used with Stripe's ACH API.
 *
 * @param accessToken Plaid access token
 * @param accountId Plaid account ID
 * @returns Processor token for Stripe
 */
export async function createStripeProcessorToken(
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
        processor: 'stripe', // Changed from 'circle' to 'stripe'
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Plaid] Failed to create Stripe processor token', data);
      return null;
    }

    console.log('[Plaid] Created Stripe processor token successfully');
    return data.processor_token;
  } catch (error) {
    console.error('[Plaid] Error creating Stripe processor token', error);
    return null;
  }
}

/**
 * Fetches bank accounts from Plaid and returns the first eligible account for ACH payments
 *
 * Prioritizes checking accounts, then savings accounts for ACH debits.
 *
 * @param accessToken Plaid access token
 * @returns First eligible account ID, or null if none found
 */
export async function getPlaidAccountForACH(accessToken: string): Promise<{
  accountId: string;
  accountName: string;
  accountType: string;
  mask: string;
} | null> {
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

    const response = await fetch(`${plaidBaseUrl}/accounts/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: plaidClientId,
        secret: plaidSecret,
        access_token: accessToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Plaid] Failed to fetch accounts', data);
      return null;
    }

    // Find the first checking or savings account (eligible for ACH)
    const accounts = data.accounts || [];

    // Prioritize checking accounts for ACH debits
    const checkingAccount = accounts.find(
      (acc: { type: string; subtype: string }) =>
        acc.type === 'depository' && acc.subtype === 'checking'
    );

    if (checkingAccount) {
      console.log('[Plaid] Selected checking account for ACH', {
        accountId: checkingAccount.account_id,
        mask: checkingAccount.mask,
      });
      return {
        accountId: checkingAccount.account_id,
        accountName: checkingAccount.name || 'Checking Account',
        accountType: 'checking',
        mask: checkingAccount.mask || '****',
      };
    }

    // Fall back to savings if no checking available
    const savingsAccount = accounts.find(
      (acc: { type: string; subtype: string }) =>
        acc.type === 'depository' && acc.subtype === 'savings'
    );

    if (savingsAccount) {
      console.log('[Plaid] Selected savings account for ACH', {
        accountId: savingsAccount.account_id,
        mask: savingsAccount.mask,
      });
      return {
        accountId: savingsAccount.account_id,
        accountName: savingsAccount.name || 'Savings Account',
        accountType: 'savings',
        mask: savingsAccount.mask || '****',
      };
    }

    console.warn('[Plaid] No eligible ACH accounts found');
    return null;
  } catch (error) {
    console.error('[Plaid] Error fetching accounts', error);
    return null;
  }
}

// ============================================================================
// Bank Account Management
// ============================================================================

/**
 * Attaches a bank account to a Stripe customer using a Plaid processor token
 *
 * Stripe's integration with Plaid uses the processor token directly via
 * the Financial Connections API or by creating a bank account source.
 *
 * @param customerId Stripe customer ID
 * @param processorToken Plaid processor token (created with processor: 'stripe')
 * @returns The PaymentMethod ID and bank details
 */
export async function attachBankAccountToCustomer(
  customerId: string,
  processorToken: string
): Promise<{ paymentMethodId: string; bankLast4: string; bankName: string | null } | null> {
  try {
    const stripe = getStripeClient();

    // For Plaid integration with Stripe, we create a bank account source
    // using the btok_ token from Plaid's processor token exchange
    // The processor token from Plaid can be used to create a source
    const source = await stripe.customers.createSource(customerId, {
      source: processorToken, // Plaid processor token (btok_xxx format)
    });

    // The source is a bank account that can be used for ACH
    const bankSource = source as Stripe.BankAccount;

    console.log('[Stripe] Attached bank account to customer', {
      customerId,
      sourceId: bankSource.id,
      bankLast4: bankSource.last4,
    });

    return {
      paymentMethodId: bankSource.id,
      bankLast4: bankSource.last4 || '****',
      bankName: bankSource.bank_name || null,
    };
  } catch (error) {
    console.error('[Stripe] Error attaching bank account', error);
    return null;
  }
}

/**
 * Creates a SetupIntent for collecting bank account details via Stripe Financial Connections
 * This is an alternative to using Plaid processor tokens directly
 *
 * @param customerId Stripe customer ID
 * @returns SetupIntent client secret for frontend use
 */
export async function createBankAccountSetupIntent(
  customerId: string
): Promise<{ clientSecret: string; setupIntentId: string } | null> {
  try {
    const stripe = getStripeClient();

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['us_bank_account'],
      payment_method_options: {
        us_bank_account: {
          financial_connections: {
            permissions: ['payment_method', 'balances'],
          },
        },
      },
    });

    return {
      clientSecret: setupIntent.client_secret!,
      setupIntentId: setupIntent.id,
    };
  } catch (error) {
    console.error('[Stripe] Error creating SetupIntent', error);
    return null;
  }
}

// ============================================================================
// Payment Processing
// ============================================================================

/**
 * Initiates an ACH payment for loan repayment
 *
 * @param request Payment request details
 * @returns Payment initiation result
 */
export async function initiateACHRepayment(
  request: StripePaymentRequest
): Promise<StripePaymentResponse> {
  try {
    const config = getStripeConfig();
    const stripe = getStripeClient();

    // Convert amount to cents (Stripe expects amounts in smallest currency unit)
    const amountInCents = Math.round(request.amount * 100);

    console.log('[Stripe ACH] Initiating payment', {
      loanId: request.loanId,
      amount: request.amount,
      amountInCents,
      environment: config.environment,
    });

    // SECURITY: Validate customer IP address for mandate compliance
    // Stripe and NACHA require accurate IP capture for ACH debit authorization
    if (!request.customerIpAddress || request.customerIpAddress === '0.0.0.0' || request.customerIpAddress === 'unknown') {
      console.error('[Stripe ACH] Invalid customer IP address for mandate');
      return {
        success: false,
        error: 'Unable to capture customer IP address for payment authorization',
      };
    }

    // Create a PaymentIntent for ACH Direct Debit
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      customer: request.customerId,
      payment_method: request.paymentMethodId,
      payment_method_types: ['us_bank_account'],
      confirm: true, // Immediately attempt to confirm the payment
      mandate_data: {
        customer_acceptance: {
          type: 'online',
          online: {
            // SECURITY FIX: Use actual customer IP for mandate compliance
            ip_address: request.customerIpAddress,
            user_agent: request.userAgent || 'locale-lending-web',
          },
        },
      },
      metadata: {
        loanId: request.loanId,
        borrowerAddress: request.borrowerAddress,
        platform: 'locale-lending',
        ...request.metadata,
      },
      description: `Loan repayment for ${request.loanId}`,
    });

    console.log('[Stripe ACH] PaymentIntent created', {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    });

    // For ACH, status will typically be 'processing' after confirmation
    // The final 'succeeded' status comes via webhook after ACH settlement
    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret || undefined,
      status: paymentIntent.status,
    };
  } catch (error) {
    console.error('[Stripe ACH] Error initiating payment', error);

    if (error instanceof Stripe.errors.StripeError) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Gets the status of a Stripe PaymentIntent
 *
 * @param paymentIntentId Stripe PaymentIntent ID
 * @returns Payment status details
 */
export async function getPaymentStatus(
  paymentIntentId: string
): Promise<StripePaymentStatus | null> {
  try {
    const stripe = getStripeClient();

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      amountReceived: paymentIntent.amount_received,
      currency: paymentIntent.currency,
      createdAt: new Date(paymentIntent.created * 1000),
      metadata: paymentIntent.metadata as Record<string, string>,
    };
  } catch (error) {
    console.error('[Stripe] Error getting payment status', error);
    return null;
  }
}

/**
 * Cancels a PaymentIntent if it hasn't been processed yet
 *
 * @param paymentIntentId Stripe PaymentIntent ID
 * @returns Whether cancellation was successful
 */
export async function cancelPayment(
  paymentIntentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const stripe = getStripeClient();

    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

    console.log('[Stripe] Payment cancelled', {
      paymentIntentId,
      status: paymentIntent.status,
    });

    return { success: true };
  } catch (error) {
    console.error('[Stripe] Error cancelling payment', error);

    if (error instanceof Stripe.errors.StripeError) {
      return { success: false, error: error.message };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Webhook Verification
// ============================================================================

/**
 * Verifies Stripe webhook signature and constructs the event
 *
 * @param payload Raw request body as string
 * @param signature Stripe-Signature header value
 * @returns Verified Stripe event or null if verification fails
 */
export function verifyAndConstructWebhookEvent(
  payload: string,
  signature: string
): Stripe.Event | null {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured');
    return null;
  }

  try {
    const stripe = getStripeClient();
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error('[Stripe Webhook] Signature verification failed', error);
    return null;
  }
}

/**
 * Simple signature verification without constructing the event
 * Useful for quick validation before processing
 *
 * @param payload Raw request body as string
 * @param signature Stripe-Signature header value
 * @returns Whether the signature is valid
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const event = verifyAndConstructWebhookEvent(payload, signature);
  return event !== null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Converts cents to dollars
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Converts dollars to cents
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Maps Stripe PaymentIntent status to our PaymentStatus enum
 */
export function mapStripeStatusToPaymentStatus(
  stripeStatus: Stripe.PaymentIntent.Status
): 'PENDING' | 'CONFIRMED' | 'PAID' | 'FAILED' {
  switch (stripeStatus) {
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
      return 'PENDING';
    case 'processing':
      return 'CONFIRMED'; // ACH is in transit
    case 'succeeded':
      return 'PAID';
    case 'canceled':
    case 'requires_capture': // Should not happen for ACH
    default:
      return 'FAILED';
  }
}
