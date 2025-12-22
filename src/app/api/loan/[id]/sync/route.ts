import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';
import { syncTransactionsForLoan } from '@/services/plaid/transactionSync';
import { calculateAndSubmitDSCR } from '@/services/dscr/calculator';
import { checkRateLimit, getClientIp, rateLimits, rateLimitHeaders } from '@/lib/rate-limit';
import { decryptField } from '@/lib/encryption';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'loan-sync' });

/**
 * POST /api/loan/[id]/sync
 *
 * Manually trigger a transaction sync for a specific loan.
 * This fetches latest transactions from Plaid, stores them,
 * and submits DSCR verification to Cartesi.
 *
 * Rate limited to prevent abuse.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const accountAddress = session?.address;

    if (!accountAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const clientIp = await getClientIp();
    const rateLimitResult = await checkRateLimit(clientIp, rateLimits.api);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many sync requests. Please wait a moment and try again.' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    const { id: loanApplicationId } = await params;
    const normalizedAddress = accountAddress.toLowerCase();

    // Verify ownership of loan application and get Plaid tokens
    const loanApplication = await prisma.loanApplication.findFirst({
      where: {
        id: loanApplicationId,
        accountAddress: normalizedAddress,
      },
      select: {
        id: true,
        plaidAccessToken: true,
        plaidTransactionsCursor: true,
        accountAddress: true,
        loanAmount: true,
        lastSyncedAt: true,
        // Also get tokens from the plaid_item_access_tokens table
        plaidItemAccessToken: {
          select: {
            accessToken: true,
            itemId: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1, // Get the most recent token
        },
      },
    });

    if (!loanApplication) {
      return NextResponse.json({ error: 'Loan application not found' }, { status: 404 });
    }

    // Check both the direct field and the related table for access token
    const encryptedToken = loanApplication.plaidAccessToken ||
      loanApplication.plaidItemAccessToken?.[0]?.accessToken;

    if (!encryptedToken) {
      return NextResponse.json(
        { error: 'No bank account connected. Please connect your bank first.' },
        { status: 400 }
      );
    }

    // Decrypt the access token before use
    const accessToken = decryptField(encryptedToken);

    // Check if sync was done recently (within last 1 minute - reduced for development)
    const syncCooldownMs = 1 * 60 * 1000; // 1 minute for dev, increase to 5 for production
    const cooldownAgo = new Date(Date.now() - syncCooldownMs);
    if (loanApplication.lastSyncedAt && loanApplication.lastSyncedAt > cooldownAgo) {
      const nextSyncAvailable = new Date(loanApplication.lastSyncedAt.getTime() + syncCooldownMs);
      return NextResponse.json({
        success: true,
        message: 'Already synced recently',
        lastSyncedAt: loanApplication.lastSyncedAt.toISOString(),
        nextSyncAvailable: nextSyncAvailable.toISOString(),
        transactionsAdded: 0,
        dscrSubmitted: false,
      });
    }

    log.info({
      loanId: loanApplicationId,
      tokenSource: loanApplication.plaidAccessToken ? 'direct' : 'table'
    }, 'Starting manual sync');

    // Step 1: Sync transactions from Plaid
    const syncResult = await syncTransactionsForLoan({
      loanId: loanApplicationId,
      accessToken: accessToken,
      cursor: loanApplication.plaidTransactionsCursor || undefined,
    });

    if (!syncResult.success) {
      log.error({ loanId: loanApplicationId, error: syncResult.error }, 'Sync failed');
      return NextResponse.json(
        { error: 'Failed to sync transactions' },
        { status: 500 }
      );
    }

    log.info({
      loanId: loanApplicationId,
      transactionsAdded: syncResult.transactionsAdded
    }, 'Transactions synced');

    // Step 2: Calculate and submit DSCR to Cartesi
    // Always recalculate DSCR on manual sync since the user explicitly requested it
    // This ensures the 3-month rolling window is applied with current date
    let dscrSubmitted = false;
    let dscrError: string | undefined;

    try {
      await calculateAndSubmitDSCR(loanApplicationId);
      dscrSubmitted = true;
      log.info({ loanId: loanApplicationId }, 'DSCR submitted');
    } catch (error) {
      log.error({ loanId: loanApplicationId, err: error }, 'DSCR submission error');
      dscrError = 'DSCR submission failed';
    }

    return NextResponse.json({
      success: true,
      loanId: loanApplicationId,
      transactionsAdded: syncResult.transactionsAdded,
      transactionsModified: syncResult.transactionsModified,
      transactionsRemoved: syncResult.transactionsRemoved,
      dscrSubmitted,
      dscrError,
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (error) {
    log.error({ err: error }, 'Unexpected error');
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
