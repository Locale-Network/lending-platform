import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@prisma/index';
import {
  verifyAndConstructWebhookEvent,
  centsToDollars,
  mapStripeStatusToPaymentStatus,
} from '@/services/stripe/achPayments';
import { makePartialRepayment } from '@/services/contracts/creditTreasuryPool';
import { parseUnits } from 'ethers';
import { paymentLogger } from '@/lib/logger';
import { checkAndMarkWebhook, clearWebhookProcessed } from '@/lib/webhook-dedup';

const log = paymentLogger.child({ webhook: 'stripe' });

// Valid payment state transitions (current -> allowed next states)
// PENDING -> CONFIRMED, PAID, FAILED
// CONFIRMED -> PAID, FAILED
// PAID -> (terminal - no transitions allowed)
// FAILED -> CONFIRMED, PAID (retry scenarios)
const TERMINAL_STATES = ['PAID'] as const;

/**
 * Stripe Webhook Handler
 *
 * Receives payment status updates from Stripe and processes loan repayments.
 *
 * Flow:
 * 1. Stripe sends webhook when PaymentIntent status changes
 * 2. Verify webhook signature using Stripe SDK
 * 3. If payment succeeded, record repayment on-chain
 * 4. Update database with payment status
 *
 * Webhook Events for ACH Direct Debit:
 * - payment_intent.processing: ACH payment is being processed (in transit)
 * - payment_intent.succeeded: Payment has been successfully received
 * - payment_intent.payment_failed: Payment failed
 */

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature') || '';

    // Verify webhook signature - FAIL CLOSED if not configured
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      log.error('STRIPE_WEBHOOK_SECRET not configured - rejecting webhook');
      return NextResponse.json(
        { error: 'Webhook verification not configured' },
        { status: 500 }
      );
    }

    // Verify signature and construct event
    const event = verifyAndConstructWebhookEvent(rawBody, signature);

    if (!event) {
      log.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Log webhook receipt for audit trail
    log.info('Webhook signature verified');

    const webhookId = `${event.type}:${event.id}`;

    // Check for replay attack - skip if already processed
    const { isNew } = await checkAndMarkWebhook(webhookId, 'stripe');
    if (!isNew) {
      log.info({ webhookId }, 'Duplicate webhook - already processed');
      return NextResponse.json({ success: true, duplicate: true });
    }

    log.info(
      {
        eventType: event.type,
        eventId: event.id,
      },
      'Received webhook event'
    );

    // Handle different webhook events
    switch (event.type) {
      case 'payment_intent.processing':
        await handlePaymentProcessing(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.succeeded': {
        const onChainOk = await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        if (!onChainOk) {
          // On-chain recording failed — clear dedup so Stripe can retry
          await clearWebhookProcessed(webhookId, 'stripe');
          return NextResponse.json(
            { error: 'On-chain recording failed, will retry' },
            { status: 500 }
          );
        }
        break;
      }

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        log.warn({ eventType: event.type }, 'Unhandled event type');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, 'Error processing webhook');
    // Don't expose internal error details to external callers
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

/**
 * Handle payment_intent.processing event
 *
 * ACH payment has been initiated and is being processed.
 * The funds are in transit but not yet settled.
 */
async function handlePaymentProcessing(paymentIntent: Stripe.PaymentIntent) {
  const { id: paymentIntentId, metadata, amount, currency } = paymentIntent;
  const loanId = metadata?.loanId;

  if (!loanId) {
    log.warn({ paymentIntentId }, 'No loanId in payment metadata');
    return;
  }

  const amountInDollars = centsToDollars(amount);

  log.info(
    { paymentIntentId, loanId, amount: amountInDollars, currency },
    'Payment processing (ACH in transit)'
  );

  // Guard: don't revert a terminal state (e.g., PAID -> CONFIRMED)
  const existing = await prisma.paymentRecord.findUnique({
    where: { externalPaymentId: paymentIntentId },
    select: { status: true },
  });

  if (existing && TERMINAL_STATES.includes(existing.status as typeof TERMINAL_STATES[number])) {
    log.warn({ paymentIntentId, currentStatus: existing.status }, 'Ignoring processing event — payment already in terminal state');
    return;
  }

  // Record payment as CONFIRMED (processing) in database
  await prisma.paymentRecord.upsert({
    where: { externalPaymentId: paymentIntentId },
    create: {
      externalPaymentId: paymentIntentId,
      loanApplicationId: loanId,
      amount: amountInDollars,
      currency: currency.toUpperCase(),
      status: 'CONFIRMED',
      provider: 'STRIPE',
      confirmedAt: new Date(),
    },
    update: {
      status: 'CONFIRMED',
      confirmedAt: new Date(),
    },
  });
}

/**
 * Handle payment_intent.succeeded event
 *
 * Payment has been successfully received.
 * This is when we record the repayment on-chain.
 */
async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<boolean> {
  const { id: paymentIntentId, metadata, amount, amount_received, currency } = paymentIntent;
  const loanId = metadata?.loanId;

  if (!loanId) {
    log.warn({ paymentIntentId }, 'No loanId in payment metadata');
    return true; // Not retryable — no loanId means nothing to record
  }

  const amountInDollars = centsToDollars(amount_received || amount);

  log.info(
    { paymentIntentId, loanId, amount: amountInDollars, currency },
    'Payment succeeded (funds received)'
  );

  // Update payment record to PAID status
  const paymentRecord = await prisma.paymentRecord.upsert({
    where: { externalPaymentId: paymentIntentId },
    create: {
      externalPaymentId: paymentIntentId,
      loanApplicationId: loanId,
      amount: amountInDollars,
      currency: currency.toUpperCase(),
      status: 'PAID',
      provider: 'STRIPE',
      paidAt: new Date(),
    },
    update: {
      status: 'PAID',
      paidAt: new Date(),
    },
  });

  // Record the repayment on-chain
  // Convert USD amount to token units (USDC has 6 decimals)
  // Even though we're receiving USD via Stripe, on-chain we still track in USDC-equivalent units
  const repaymentAmount = parseUnits(amountInDollars.toFixed(2), 6);

  log.info(
    { paymentIntentId, loanId, repaymentAmount: repaymentAmount.toString() },
    'Recording repayment on-chain'
  );

  const onChainResult = await makePartialRepayment(loanId, repaymentAmount);

  if (onChainResult.success) {
    // Update payment record with on-chain transaction hash
    await prisma.paymentRecord.update({
      where: { id: paymentRecord.id },
      data: {
        onChainTxHash: onChainResult.txHash,
        onChainRecorded: true,
      },
    });

    log.info(
      {
        paymentIntentId,
        loanId,
        txHash: onChainResult.txHash,
        isFullyRepaid: onChainResult.isFullyRepaid,
      },
      'Payment recorded on-chain successfully'
    );

    // If loan is fully repaid, update the loan application status
    if (onChainResult.isFullyRepaid) {
      await prisma.loanApplication.update({
        where: { id: loanId },
        data: { status: 'REPAID' },
      });

      log.info({ loanId }, 'Loan fully repaid');
    }

    return true;
  } else {
    log.error(
      { paymentIntentId, loanId, error: onChainResult.error },
      'Failed to record repayment on-chain — will retry via Stripe'
    );

    // Mark the payment record for retry
    await prisma.paymentRecord.update({
      where: { id: paymentRecord.id },
      data: {
        onChainRecorded: false,
        failureReason: `On-chain recording failed: ${onChainResult.error}`,
      },
    });

    return false; // Signal caller to clear dedup and return 500 for Stripe retry
  }
}

/**
 * Handle payment_intent.payment_failed event
 *
 * The payment failed for some reason (NSF, account closed, etc.)
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const { id: paymentIntentId, metadata, amount, currency, last_payment_error } = paymentIntent;
  const loanId = metadata?.loanId;

  const errorCode = last_payment_error?.code;
  const errorMessage = last_payment_error?.message;
  const declineCode = last_payment_error?.decline_code;

  log.error(
    {
      paymentIntentId,
      loanId,
      errorCode,
      errorMessage,
      declineCode,
    },
    'Payment failed'
  );

  if (loanId) {
    // Guard: don't revert a terminal state (e.g., PAID -> FAILED)
    const existing = await prisma.paymentRecord.findUnique({
      where: { externalPaymentId: paymentIntentId },
      select: { status: true },
    });

    if (existing && TERMINAL_STATES.includes(existing.status as typeof TERMINAL_STATES[number])) {
      log.warn(
        { paymentIntentId, currentStatus: existing.status },
        'Ignoring failure event — payment already in terminal state (on-chain repayment recorded)'
      );
      return;
    }

    const amountInDollars = centsToDollars(amount);
    const failureReason = errorMessage || errorCode || declineCode || 'Unknown error';

    // Update payment record
    await prisma.paymentRecord.upsert({
      where: { externalPaymentId: paymentIntentId },
      create: {
        externalPaymentId: paymentIntentId,
        loanApplicationId: loanId,
        amount: amountInDollars,
        currency: currency.toUpperCase(),
        status: 'FAILED',
        provider: 'STRIPE',
        failedAt: new Date(),
        failureReason,
      },
      update: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason,
      },
    });

    // Get the loan application to find the borrower
    const loanApplication = await prisma.loanApplication.findUnique({
      where: { id: loanId },
      select: { accountAddress: true, businessLegalName: true },
    });

    if (loanApplication) {
      // TODO: Queue email notification for borrower about failed payment
      // This should be implemented when email service is configured
      log.info(
        { loanId, borrower: loanApplication.accountAddress },
        'Payment failed - notification pending email configuration'
      );
    }
  }
}
