import { NextRequest, NextResponse } from 'next/server';
import { syncTransactionsForAllLoans } from '@/services/plaid/transactionSync';
import { triggerDSCRCalculation } from '@/services/dscr/calculator';
import { checkRateLimit, getClientIp, rateLimits, rateLimitHeaders, validateCronSecret } from '@/lib/rate-limit';
import { cronLogger } from '@/lib/logger';

const log = cronLogger.child({ job: 'sync-transactions' });

/**
 * Scheduled Transaction Sync Cron Job
 *
 * Runs every 12 hours by default (configurable via vercel.json).
 * Fetches new transactions from Plaid for active loans and triggers DSCR recalculation.
 *
 * Configuration via Environment Variables:
 * - DAILY_SYNC_ENABLED: Set to 'false' to disable sync entirely
 * - SYNC_ALL_ACTIVE_LOANS: Set to 'false' to only sync loans with recent activity (default: true)
 * - SYNC_RECENT_ACTIVITY_DAYS: Days to consider as "recent" (default: 30)
 *
 * Flow:
 * 1. Fetch active loans from database (filtered by config)
 * 2. For each loan, sync latest transactions from Plaid
 * 3. Store transactions in PostgreSQL
 * 4. Trigger DSCR calculation and Cartesi submission
 * 5. Return summary of sync results
 */

// Configuration from environment variables
const getSyncConfig = () => {
  const recentActivityDays = parseInt(process.env.SYNC_RECENT_ACTIVITY_DAYS || '30', 10);
  return {
    enabled: process.env.DAILY_SYNC_ENABLED !== 'false',
    syncAllActiveLoans: process.env.SYNC_ALL_ACTIVE_LOANS !== 'false',
    // SECURITY: Guard against NaN from malformed env var
    recentActivityDays: isNaN(recentActivityDays) ? 30 : Math.max(1, recentActivityDays),
  };
};

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

  // Get sync configuration
  const config = getSyncConfig();

  // Check if sync is enabled
  if (!config.enabled) {
    log.info('Scheduled sync is disabled via environment variable');
    return NextResponse.json({
      success: true,
      message: 'Scheduled sync is disabled',
      config,
      synced: 0
    });
  }

  log.info({
    syncAllActiveLoans: config.syncAllActiveLoans,
    recentActivityDays: config.recentActivityDays,
  }, 'Starting scheduled transaction sync');
  const startTime = Date.now();

  try {
    // Sync transactions for all active loans
    const syncResults = await syncTransactionsForAllLoans();

    log.info({
      totalLoans: syncResults.totalLoans,
      successful: syncResults.successful,
      failed: syncResults.failed,
      transactionsSynced: syncResults.transactionsSynced,
      durationMs: Date.now() - startTime
    }, 'Sync completed');

    // Trigger DSCR calculation for loans with new transactions
    if (syncResults.loansWithNewTransactions.length > 0) {
      log.info({ count: syncResults.loansWithNewTransactions.length }, 'Triggering DSCR calculations');

      const dscrResults = await triggerDSCRCalculation(syncResults.loansWithNewTransactions);

      log.info({
        submitted: dscrResults.submitted,
        failed: dscrResults.failed
      }, 'DSCR calculations triggered');

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
    log.error({ err: error }, 'Fatal error during sync');

    return NextResponse.json({
      success: false,
      error: 'Sync failed',
      durationMs: Date.now() - startTime
    }, { status: 500 });
  }
}
