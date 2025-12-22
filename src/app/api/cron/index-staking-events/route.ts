import { NextRequest, NextResponse } from 'next/server';
import { runIndexer } from '@/services/contracts/stakingPoolIndexer';
import { validateCronSecret } from '@/lib/rate-limit';
import { cronLogger } from '@/lib/logger';

const log = cronLogger.child({ job: 'index-staking-events' });

/**
 * POST /api/cron/index-staking-events
 *
 * Cron endpoint to index new StakingPool events from the blockchain.
 * Should be called periodically (e.g., every 5 minutes) via Vercel Cron.
 *
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/index-staking-events",
 *     "schedule": "0/5 * * * *"
 *   }]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Use standardized cron validation (CRON_SECRET is now required)
    if (!validateCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runIndexer();

    return NextResponse.json({
      success: true,
      blocksProcessed: result.blocksProcessed,
      eventsProcessed: result.eventsProcessed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error({ err: error }, 'Indexer cron error');
    return NextResponse.json(
      { error: 'Failed to run indexer' },
      { status: 500 }
    );
  }
}

// Also allow GET for manual triggering (with auth)
export async function GET(request: NextRequest) {
  return POST(request);
}
