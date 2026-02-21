import { NextRequest, NextResponse } from 'next/server';
import prisma from '@prisma/index';
import {
  getOrCreateStripeCustomer,
  initiateACHRepayment,
  createStripeProcessorToken,
  attachBankAccountToCustomer,
  getPlaidAccountForACH,
} from '@/services/stripe/achPayments';
import { paymentLogger } from '@/lib/logger';
import { decryptField } from '@/lib/encryption';
import { getSession } from '@/lib/auth/authorization';
import { checkRateLimit, getClientIp, rateLimits, rateLimitHeaders } from '@/lib/rate-limit';

const log = paymentLogger.child({ route: 'loan-pay' });

/**
 * POST /api/loan/[id]/pay
 *
 * Initiates a Stripe ACH payment for loan repayment.
 *
 * Request body:
 * - amount: number (required) - Payment amount in USD
 * - paymentMethodId?: string - Existing Stripe PaymentMethod ID
 * - plaidAccountId?: string - Plaid account ID (if setting up new payment method)
 *
 * Flow:
 * 1. Validate loan exists and is active
 * 2. Get or create Stripe customer for borrower
 * 3. If no paymentMethodId, create one from Plaid
 * 4. Initiate PaymentIntent with ACH Direct Debit
 * 5. Return payment status for frontend tracking
 */

interface PaymentRequest {
  amount: number;
  paymentMethodId?: string;
  plaidAccountId?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Require authentication
    const session = await getSession();
    const accountAddress = session?.address;

    if (!accountAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SECURITY: Rate limiting on payment endpoint (expensive operation)
    const clientIp = await getClientIp();
    const rateLimitResult = await checkRateLimit(
      `payment:${accountAddress.toLowerCase()}`,
      rateLimits.expensive
    );

    if (!rateLimitResult.success) {
      log.warn({ accountAddress }, 'Payment rate limit exceeded');
      return NextResponse.json(
        { error: 'Too many payment requests. Please wait before trying again.' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    const { id: loanId } = await params;
    const body: PaymentRequest = await request.json();

    // Validate request
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid payment amount' },
        { status: 400 }
      );
    }

    const normalizedAddress = accountAddress.toLowerCase();

    // SECURITY: Get loan and verify ownership - only the borrower can make payments
    const loan = await prisma.loanApplication.findFirst({
      where: {
        id: loanId,
        accountAddress: normalizedAddress,
      },
      include: {
        account: true,
        plaidItemAccessToken: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!loan) {
      // Don't reveal whether loan exists to prevent enumeration
      return NextResponse.json(
        { error: 'Loan not found or access denied' },
        { status: 404 }
      );
    }

    // Verify loan is in a payable state
    const payableStatuses = ['APPROVED', 'DISBURSED', 'ACTIVE'];
    if (!payableStatuses.includes(loan.status)) {
      return NextResponse.json(
        { error: `Cannot make payment on loan with status: ${loan.status}` },
        { status: 400 }
      );
    }

    const borrowerAddress = loan.accountAddress;
    const borrowerEmail = loan.account.email || undefined;

    log.info({ loanId, borrowerAddress, amount: body.amount }, 'Initiating ACH payment');

    // Step 1: Get or create Stripe customer
    const { customerId, isNew: isNewCustomer } = await getOrCreateStripeCustomer(
      borrowerAddress,
      borrowerEmail
    );

    if (isNewCustomer) {
      log.info({ customerId, borrowerAddress }, 'Created new Stripe customer');
    }

    // Step 2: Get or create payment method
    let paymentMethodId = body.paymentMethodId;

    if (!paymentMethodId) {
      // Need to create payment method from Plaid
      const plaidToken = loan.plaidItemAccessToken[0];

      if (!plaidToken) {
        return NextResponse.json(
          { error: 'No linked bank account. Please link a bank account first.' },
          { status: 400 }
        );
      }

      // Decrypt the access token
      const accessToken = decryptField(plaidToken.accessToken);

      // Get the account ID - use provided or auto-select first eligible account
      let accountId = body.plaidAccountId;

      if (!accountId) {
        // Auto-select first eligible checking/savings account from Plaid
        const plaidAccount = await getPlaidAccountForACH(accessToken);

        if (!plaidAccount) {
          return NextResponse.json(
            { error: 'No eligible bank account found for ACH payment. Please link a checking or savings account.' },
            { status: 400 }
          );
        }

        accountId = plaidAccount.accountId;
        log.info(
          { loanId, accountType: plaidAccount.accountType, mask: plaidAccount.mask },
          'Auto-selected bank account for ACH payment'
        );
      }

      // Create Stripe processor token from Plaid
      const processorToken = await createStripeProcessorToken(accessToken, accountId);

      if (!processorToken) {
        log.error({ loanId }, 'Failed to create Stripe processor token');
        return NextResponse.json(
          { error: 'Failed to link bank account with Stripe' },
          { status: 500 }
        );
      }

      // Attach bank account to customer
      const bankAccount = await attachBankAccountToCustomer(customerId, processorToken);

      if (!bankAccount) {
        log.error({ loanId, customerId }, 'Failed to attach bank account');
        return NextResponse.json(
          { error: 'Failed to attach bank account' },
          { status: 500 }
        );
      }

      paymentMethodId = bankAccount.paymentMethodId;
      log.info(
        { loanId, paymentMethodId, bankLast4: bankAccount.bankLast4 },
        'Attached bank account to Stripe customer'
      );
    }

    // Get user agent from request headers
    const userAgent = request.headers.get('user-agent') || 'locale-lending-web';

    // Step 3: Initiate ACH payment with proper mandate data
    const paymentResult = await initiateACHRepayment({
      loanId,
      amount: body.amount,
      customerId,
      paymentMethodId,
      borrowerAddress,
      // SECURITY: Pass actual client IP for ACH mandate compliance
      customerIpAddress: clientIp,
      userAgent,
      metadata: {
        loanId,
        borrowerAddress,
      },
    });

    if (!paymentResult.success) {
      log.error({ loanId, error: paymentResult.error }, 'Payment initiation failed');
      return NextResponse.json(
        { error: paymentResult.error || 'Payment failed' },
        { status: 500 }
      );
    }

    // Step 4: Create pending payment record
    await prisma.paymentRecord.create({
      data: {
        externalPaymentId: paymentResult.paymentIntentId!,
        provider: 'STRIPE',
        loanApplicationId: loanId,
        amount: body.amount,
        currency: 'USD',
        status: 'PENDING',
      },
    });

    log.info(
      {
        loanId,
        paymentIntentId: paymentResult.paymentIntentId,
        status: paymentResult.status,
      },
      'ACH payment initiated successfully'
    );

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentResult.paymentIntentId,
      status: paymentResult.status,
      message: 'Payment initiated. ACH transfers typically take 3-5 business days.',
    });
  } catch (error) {
    log.error({ err: error }, 'Error processing payment request');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/loan/[id]/pay
 *
 * Gets payment history for a loan
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY: Require authentication
    const session = await getSession();
    const accountAddress = session?.address;

    if (!accountAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: loanId } = await params;
    const normalizedAddress = accountAddress.toLowerCase();

    // SECURITY: Verify ownership - only the borrower can view their payment history
    const loan = await prisma.loanApplication.findFirst({
      where: {
        id: loanId,
        accountAddress: normalizedAddress,
      },
      select: { id: true },
    });

    if (!loan) {
      return NextResponse.json(
        { error: 'Loan not found or access denied' },
        { status: 404 }
      );
    }

    const payments = await prisma.paymentRecord.findMany({
      where: { loanApplicationId: loanId },
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        externalPaymentId: true,
        provider: true,
        amount: true,
        currency: true,
        status: true,
        confirmedAt: true,
        paidAt: true,
        failedAt: true,
        failureReason: true,
        onChainTxHash: true,
        onChainRecorded: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ payments });
  } catch (error) {
    log.error({ err: error }, 'Error fetching payment history');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
