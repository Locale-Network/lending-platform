import { NextRequest, NextResponse } from 'next/server';
import { pollAndRelayNotices } from '@/services/relay';
import { checkRateLimit, getClientIp, rateLimits, rateLimitHeaders, validateCronSecret } from '@/lib/rate-limit';
import { cronLogger } from '@/lib/logger';

const log = cronLogger.child({ job: 'relay-notices' });

/**
 * Relay Notices Cron Job
 *
 * This endpoint polls the Cartesi GraphQL for new DSCR verification notices
 * and relays them to the SimpleLoanPool contract on-chain.
 *
 * Flow:
 * 1. Poll Cartesi GraphQL for new notices
 * 2. Parse and validate DSCR verification notices
 * 3. Call SimpleLoanPool.handleNotice() for each notice
 * 4. Track processed notices to avoid duplicates
 *
 * Should be called every 30 seconds to 1 minute.
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

  log.info('Starting notice relay');
  const startTime = Date.now();

  try {
    const relayedCount = await pollAndRelayNotices();
    const durationMs = Date.now() - startTime;

    log.info({ relayedCount, durationMs }, 'Relay completed');

    return NextResponse.json({
      success: true,
      relayedCount,
      durationMs
    });

  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error({ err: error, durationMs }, 'Relay failed');

    return NextResponse.json({
      success: false,
      error: 'Failed to relay notices',
      durationMs
    }, { status: 500 });
  }
}

/**
 * POST endpoint for manual triggering (useful for testing)
 */
export async function POST(req: NextRequest) {
  // Use standardized cron validation
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  log.info('Starting manual notice relay');
  const startTime = Date.now();

  try {
    const relayedCount = await pollAndRelayNotices();
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      relayedCount,
      durationMs
    });

  } catch (error) {
    const durationMs = Date.now() - startTime;
    log.error({ err: error, durationMs }, 'Manual relay failed');

    return NextResponse.json({
      success: false,
      error: 'Failed to relay notices',
      durationMs
    }, { status: 500 });
  }
}
