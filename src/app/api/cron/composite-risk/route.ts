import { NextRequest, NextResponse } from 'next/server';
import { validateCronSecret } from '@/lib/rate-limit';
import { cronLogger } from '@/lib/logger';
import { recalculateAllPools } from '@/services/risk';

const log = cronLogger.child({ job: 'composite-risk' });

/**
 * Composite Risk CRON Job
 *
 * Recalculates composite risk scores for all active multi-borrower pools.
 * This serves as a catch-up mechanism for any missed real-time triggers.
 *
 * Recommended schedule: Every 6 hours
 * Vercel cron: 0 0,6,12,18 * * *
 */
export async function GET(req: NextRequest) {
  // Validate cron secret
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  log.info('Starting composite risk recalculation for all pools');

  try {
    const startTime = Date.now();
    const result = await recalculateAllPools();
    const duration = Date.now() - startTime;

    log.info(
      {
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        durationMs: duration,
      },
      'Composite risk recalculation complete'
    );

    return NextResponse.json({
      success: true,
      ...result,
      durationMs: duration,
    });
  } catch (error) {
    log.error({ err: error }, 'Composite risk recalculation failed');

    return NextResponse.json(
      { error: 'Composite risk recalculation failed' },
      { status: 500 }
    );
  }
}
