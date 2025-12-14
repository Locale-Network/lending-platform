import { NextRequest, NextResponse } from 'next/server';
import { syncTransactionsForAllLoans } from '@/services/plaid/transactionSync';
import { triggerDSCRCalculation } from '@/services/dscr/calculator';
import { checkRateLimit, getClientIp, rateLimits, rateLimitHeaders, validateCronSecret } from '@/lib/rate-limit';

/**
 * Daily Transaction Sync Cron Job
 *
 * This endpoint should be called once daily (e.g., via Vercel Cron or external scheduler)
 * to fetch new transactions from Plaid for all active loans and trigger DSCR recalculation.
 *
 * Flow:
 * 1. Fetch all active loans from database
 * 2. For each loan, sync latest transactions from Plaid
 * 3. Store transactions in PostgreSQL
 * 4. Trigger DSCR calculation and Cartesi submission
 * 5. Return summary of sync results
 */
export async function GET(req: NextRequest) {
  // Verify cron secret for security
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting for cron endpoint
  const clientIp = await getClientIp();
  const rateLimitResult = await checkRateLimit(clientIp, rateLimits.cron);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  // Check if daily sync is enabled
  const syncEnabled = process.env.DAILY_SYNC_ENABLED !== 'false';
  if (!syncEnabled) {
    console.log('[Transaction Sync] Daily sync is disabled via environment variable');
    return NextResponse.json({
      success: true,
      message: 'Daily sync is disabled',
      synced: 0
    });
  }

  console.log('[Transaction Sync] Starting daily transaction sync...');
  const startTime = Date.now();

  try {
    // Sync transactions for all active loans
    const syncResults = await syncTransactionsForAllLoans();

    console.log('[Transaction Sync] Sync completed:', {
      totalLoans: syncResults.totalLoans,
      successful: syncResults.successful,
      failed: syncResults.failed,
      transactionsSynced: syncResults.transactionsSynced,
      durationMs: Date.now() - startTime
    });

    // Trigger DSCR calculation for loans with new transactions
    if (syncResults.loansWithNewTransactions.length > 0) {
      console.log('[Transaction Sync] Triggering DSCR calculations for', syncResults.loansWithNewTransactions.length, 'loans');

      const dscrResults = await triggerDSCRCalculation(syncResults.loansWithNewTransactions);

      console.log('[Transaction Sync] DSCR calculations triggered:', {
        submitted: dscrResults.submitted,
        failed: dscrResults.failed
      });

      return NextResponse.json({
        success: true,
        sync: {
          totalLoans: syncResults.totalLoans,
          successful: syncResults.successful,
          failed: syncResults.failed,
          transactionsSynced: syncResults.transactionsSynced
        },
        dscr: {
          submitted: dscrResults.submitted,
          failed: dscrResults.failed
        },
        durationMs: Date.now() - startTime
      });
    }

    return NextResponse.json({
      success: true,
      sync: {
        totalLoans: syncResults.totalLoans,
        successful: syncResults.successful,
        failed: syncResults.failed,
        transactionsSynced: syncResults.transactionsSynced
      },
      message: 'No new transactions to process',
      durationMs: Date.now() - startTime
    });

  } catch (error) {
    console.error('[Transaction Sync] Fatal error during sync:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - startTime
    }, { status: 500 });
  }
}
