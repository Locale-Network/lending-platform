import { NextRequest, NextResponse } from 'next/server';
import prisma from '@prisma/index';
import { verifyWebhookSignature } from '@/services/circle/achPayments';
import { makePartialRepayment } from '@/services/contracts/creditTreasuryPool';
import { parseUnits } from 'ethers';
import { paymentLogger } from '@/lib/logger';
import { checkAndMarkWebhook } from '@/lib/webhook-dedup';
// TODO: Re-enable once Locale email domains are configured with Resend
// import { queueEmailNotification } from '@/services/notifications/email';

const log = paymentLogger.child({ webhook: 'circle' });

/**
 * Circle Webhook Handler
 *
 * Receives payment status updates from Circle and processes loan repayments.
 *
 * Flow:
 * 1. Circle sends webhook when payment status changes
 * 2. Verify webhook signature
 * 3. If payment confirmed, record repayment on-chain
 * 4. Update database with payment status
 *
 * Webhook Events:
 * - payment.confirmed: ACH payment has been confirmed
 * - payment.paid: USDC has been deposited to treasury
 * - payment.failed: Payment failed
 */

interface CircleWebhookPayload {
  type: string;
  data: {
    id: string;
    type: string;
    status: string;
    amount: {
      amount: string;
      currency: string;
    };
    createDate: string;
    updateDate: string;
    metadata?: {
      loanId?: string;
      borrowerAddress?: string;
    };
    errorCode?: string;
    riskEvaluation?: {
      decision: string;
      reason: string;
    };
  };
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('circle-signature') || '';

    // Verify webhook signature - FAIL CLOSED if not configured
    if (!process.env.CIRCLE_WEBHOOK_SECRET) {
      log.error('CIRCLE_WEBHOOK_SECRET not configured - rejecting webhook');
      return NextResponse.json(
        { error: 'Webhook verification not configured' },
        { status: 500 }
      );
    }

    if (!verifyWebhookSignature(rawBody, signature)) {
      log.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Log webhook receipt for audit trail
    log.info('Webhook signature verified');

    const payload: CircleWebhookPayload = JSON.parse(rawBody);
    const webhookId = `${payload.type}:${payload.data.id}:${payload.data.status}`;

    // Check for replay attack - skip if already processed
    const { isNew } = await checkAndMarkWebhook(webhookId, 'circle');
    if (!isNew) {
      log.info({ webhookId }, 'Duplicate webhook - already processed');
      return NextResponse.json({ success: true, duplicate: true });
    }

    log.info({
      eventType: payload.type,
      paymentId: payload.data.id,
      status: payload.data.status,
    }, 'Received webhook event');

    // Handle different webhook events
    switch (payload.type) {
      case 'payment.confirmed':
        await handlePaymentConfirmed(payload);
        break;

      case 'payment.paid':
        await handlePaymentPaid(payload);
        break;

      case 'payment.failed':
        await handlePaymentFailed(payload);
        break;

      default:
        log.warn({ eventType: payload.type }, 'Unhandled event type');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error }, 'Error processing webhook');
    // Don't expose internal error details to external callers
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle payment.confirmed event
 *
 * ACH payment has been confirmed by the bank.
 * The funds are in transit but not yet settled.
 */
async function handlePaymentConfirmed(payload: CircleWebhookPayload) {
  const { id: paymentId, metadata, amount } = payload.data;
  const loanId = metadata?.loanId;

  if (!loanId) {
    log.warn({ paymentId }, 'No loanId in payment metadata');
    return;
  }

  log.info({ paymentId, loanId, amount: amount.amount }, 'Payment confirmed');

  // Record payment as pending in database
  await prisma.paymentRecord.upsert({
    where: { externalPaymentId: paymentId },
    create: {
      externalPaymentId: paymentId,
      loanApplicationId: loanId,
      amount: parseFloat(amount.amount),
      currency: amount.currency,
      status: 'CONFIRMED',
      provider: 'CIRCLE',
      confirmedAt: new Date(),
    },
    update: {
      status: 'CONFIRMED',
      confirmedAt: new Date(),
    },
  });
}

/**
 * Handle payment.paid event
 *
 * USDC has been deposited to our Circle treasury wallet.
 * This is when we should record the repayment on-chain.
 */
async function handlePaymentPaid(payload: CircleWebhookPayload) {
  const { id: paymentId, metadata, amount } = payload.data;
  const loanId = metadata?.loanId;

  if (!loanId) {
    log.warn({ paymentId }, 'No loanId in payment metadata');
    return;
  }

  log.info({ paymentId, loanId, amount: amount.amount }, 'Payment paid (USDC received)');

  // Update payment record to PAID status
  const paymentRecord = await prisma.paymentRecord.upsert({
    where: { externalPaymentId: paymentId },
    create: {
      externalPaymentId: paymentId,
      loanApplicationId: loanId,
      amount: parseFloat(amount.amount),
      currency: amount.currency,
      status: 'PAID',
      provider: 'CIRCLE',
      paidAt: new Date(),
    },
    update: {
      status: 'PAID',
      paidAt: new Date(),
    },
  });

  // Record the repayment on-chain
  // Convert USD amount to token units (USDC has 6 decimals)
  const repaymentAmount = parseUnits(amount.amount, 6);

  log.info({ paymentId, loanId, repaymentAmount: repaymentAmount.toString() }, 'Recording repayment on-chain');

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

    log.info({
      paymentId,
      loanId,
      txHash: onChainResult.txHash,
      isFullyRepaid: onChainResult.isFullyRepaid,
    }, 'Payment recorded on-chain successfully');

    // If loan is fully repaid, update the loan application status
    if (onChainResult.isFullyRepaid) {
      await prisma.loanApplication.update({
        where: { id: loanId },
        data: { status: 'REPAID' },
      });

      log.info({ loanId }, 'Loan fully repaid');
    }
  } else {
    // Log the error but don't fail the webhook
    // The payment is still recorded in the database for manual reconciliation
    log.error({ paymentId, loanId, error: onChainResult.error }, 'Failed to record repayment on-chain');

    // Mark the payment record for retry
    await prisma.paymentRecord.update({
      where: { id: paymentRecord.id },
      data: {
        onChainRecorded: false,
        failureReason: `On-chain recording failed: ${onChainResult.error}`,
      },
    });
  }
}

/**
 * Handle payment.failed event
 *
 * The ACH payment failed for some reason (NSF, account closed, etc.)
 */
async function handlePaymentFailed(payload: CircleWebhookPayload) {
  const { id: paymentId, metadata, amount, errorCode, riskEvaluation } = payload.data;
  const loanId = metadata?.loanId;

  log.error({ paymentId, loanId, errorCode, riskReason: riskEvaluation?.reason }, 'Payment failed');

  if (loanId) {
    // Update payment record
    await prisma.paymentRecord.upsert({
      where: { externalPaymentId: paymentId },
      create: {
        externalPaymentId: paymentId,
        loanApplicationId: loanId,
        amount: parseFloat(amount.amount),
        currency: amount.currency,
        status: 'FAILED',
        provider: 'CIRCLE',
        failedAt: new Date(),
        failureReason: errorCode || riskEvaluation?.reason || 'Unknown error',
      },
      update: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: errorCode || riskEvaluation?.reason || 'Unknown error',
      },
    });

    // Get the loan application to find the borrower
    const loanApplication = await prisma.loanApplication.findUnique({
      where: { id: loanId },
      select: { accountAddress: true, businessLegalName: true },
    });

    if (loanApplication) {
      // TODO: Re-enable once Locale email domains are configured with Resend
      // Queue email notification for borrower
      // const failureReason = errorCode || riskEvaluation?.reason || 'Payment could not be processed';
      // await queueEmailNotification({
      //   recipientAddress: loanApplication.accountAddress,
      //   type: 'PAYMENT_DUE',
      //   data: {
      //     loanId,
      //     amountDue: parseFloat(amount.amount),
      //     dueDate: 'Immediately',
      //     daysUntilDue: 0,
      //     borrowerName: loanApplication.businessLegalName,
      //     failureReason,
      //   },
      // });

      log.info({ loanId, borrower: loanApplication.accountAddress }, 'Payment failed - notification deferred until email configured');
    }
  }
}
