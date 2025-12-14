import { NextRequest, NextResponse } from 'next/server';
import { runIndexer } from '@/services/contracts/stakingPoolIndexer';

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
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
    console.error('Indexer cron error:', error);
    return NextResponse.json(
      { error: 'Failed to run indexer', details: String(error) },
      { status: 500 }
    );
  }
}

// Also allow GET for manual triggering (with auth)
export async function GET(request: NextRequest) {
  return POST(request);
}
