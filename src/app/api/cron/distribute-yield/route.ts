import { NextRequest, NextResponse } from 'next/server';
import prisma from '@prisma/index';
import {
  queryLoanRepaymentEvents,
  distributeYield,
  getLastYieldDistributionBlock,
  setLastYieldDistributionBlock,
  getCurrentBlockNumber,
} from '@/services/contracts/poolBridge';
import { hashLoanId } from '@/lib/contracts/loanPool';
import {
  checkRateLimit,
  getClientIp,
  rateLimits,
  rateLimitHeaders,
  validateCronSecret,
} from '@/lib/rate-limit';
import { withLock } from '@/lib/distributed-lock';
import { cronLogger } from '@/lib/logger';

const log = cronLogger.child({ job: 'distribute-yield' });

/**
 * Yield Distribution Cron Job
 *
 * Automates yield distribution from loan repayments to StakingPool investors.
 *
 * Architecture (inspired by CIRCLE_ACH_REPAYMENT_FLOW):
 * SimpleLoanPool (LoanRepaymentMade event) -> Cron Job -> StakingPool.distributeYield()
 *
 * Flow:
 * 1. Query LoanRepaymentMade events since last run
 * 2. For each repayment, extract interest portion
 * 3. Find the pool associated with the loan
 * 4. Call StakingPool.distributeYield() for each pool
 * 5. Record distribution in database
 * 6. Update indexer state
 *
 * Configuration:
 * - YIELD_DISTRIBUTION_ENABLED: Set to 'false' to disable
 * - YIELD_DISTRIBUTION_CHUNK_SIZE: Max blocks to process per run (default: 1000)
 */

// Configuration
const getConfig = () => {
  const chunkSize = parseInt(process.env.YIELD_DISTRIBUTION_CHUNK_SIZE || '1000', 10);
  return {
    enabled: process.env.YIELD_DISTRIBUTION_ENABLED !== 'false',
    // SECURITY: Guard against NaN from malformed env var
    chunkSize: isNaN(chunkSize) ? 1000 : Math.max(1, chunkSize),
  };
};

// Lock TTL: 5 minutes (longer than max cron execution time)
const LOCK_TTL_MS = 5 * 60 * 1000;
const LOCK_KEY = 'yield_distribution';

export async function GET(req: NextRequest) {
  // Verify cron secret for security
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting
  const clientIp = await getClientIp();
  const rateLimitResult = await checkRateLimit(clientIp, rateLimits.cron);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  const config = getConfig();
  const startTime = Date.now();

  // Check if enabled
  if (!config.enabled) {
    log.info('Yield distribution disabled via environment variable');
    return NextResponse.json({
      success: true,
      message: 'Yield distribution is disabled',
      config,
    });
  }

  log.info('Starting yield distribution cron');

  // Acquire distributed lock to prevent race conditions
  const lockResult = await withLock(LOCK_KEY, LOCK_TTL_MS, async () => {
    return processYieldDistribution(config, startTime);
  });

  if (!lockResult.success) {
    if (lockResult.reason === 'lock_not_acquired') {
      log.info('Lock not acquired - another instance is running');
      return NextResponse.json({
        success: true,
        message: 'Skipped - another instance is processing',
        durationMs: Date.now() - startTime,
      });
    }

    // Execution error
    log.error({ err: lockResult.error }, 'Error during locked execution');
    return NextResponse.json(
      {
        success: false,
        error: lockResult.error || 'Unknown error',
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }

  return lockResult.result;
}

/**
 * Core yield distribution logic (runs within distributed lock)
 */
async function processYieldDistribution(
  config: ReturnType<typeof getConfig>,
  startTime: number
): Promise<NextResponse> {
  // Get block range to process
  const lastBlock = await getLastYieldDistributionBlock();
  const currentBlock = await getCurrentBlockNumber();

  if (lastBlock >= currentBlock) {
    log.debug({ lastBlock, currentBlock }, 'No new blocks to process');
    return NextResponse.json({
      success: true,
      message: 'No new blocks to process',
      lastBlock,
      currentBlock,
      durationMs: Date.now() - startTime,
    });
  }

  // Process in chunks
  const toBlock = Math.min(lastBlock + config.chunkSize, currentBlock);

  log.info({
    fromBlock: lastBlock + 1,
    toBlock,
    blocksToProcess: toBlock - lastBlock,
  }, 'Processing blocks');

  // Query repayment events
  const repaymentEvents = await queryLoanRepaymentEvents(lastBlock + 1, toBlock);

  log.info({ eventCount: repaymentEvents.length }, 'Found repayment events');

  if (repaymentEvents.length === 0) {
    // Update indexer state even if no events
    await setLastYieldDistributionBlock(toBlock);

    return NextResponse.json({
      success: true,
      message: 'No repayment events found',
      fromBlock: lastBlock + 1,
      toBlock,
      eventsFound: 0,
      durationMs: Date.now() - startTime,
    });
  }

  // Pre-fetch all active loan applications ONCE (fixes N+1 query)
  const activeLoanApplications = await prisma.loanApplication.findMany({
    where: {
      status: { in: ['ACTIVE', 'DISBURSED'] },
    },
    include: {
      poolLoans: {
        include: {
          pool: true,
        },
      },
    },
  });

  // Build lookup map: on-chain loanId (keccak256) -> loan application
  const loanIdMap = new Map(
    activeLoanApplications.map(app => [hashLoanId(app.id).toLowerCase(), app])
  );

  // Process each repayment event
  const results = {
    processed: 0,
    distributed: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  // Track the highest successfully processed block for safe indexer advancement
  let lastSuccessfulBlock = lastBlock;

  for (const event of repaymentEvents) {
    results.processed++;

    try {
      // Find the loan application by matching hashed loan ID from the event
      const loanApplication = loanIdMap.get(event.loanId.toLowerCase());

      if (!loanApplication || loanApplication.poolLoans.length === 0) {
        log.warn({ loanId: event.loanId.slice(0, 10) }, 'No pool found for loan');
        results.skipped++;
        lastSuccessfulBlock = Math.max(lastSuccessfulBlock, event.blockNumber);
        continue;
      }

      // Get the pool for this loan
      const poolLoan = loanApplication.poolLoans[0];
      const pool = poolLoan.pool;

      // Only distribute interest portion as yield
      const interestAmount = event.interestAmount;
      const principalAmount = event.repaymentAmount - event.interestAmount;

      if (interestAmount <= BigInt(0)) {
        log.debug({ loanId: event.loanId.slice(0, 10) }, 'No interest to distribute');
        results.skipped++;
        lastSuccessfulBlock = Math.max(lastSuccessfulBlock, event.blockNumber);
        continue;
      }

      // Idempotency check: prevent duplicate distributions using compound index
      const existingDistribution = await prisma.yieldDistribution.findFirst({
        where: {
          sourceBlockNumber: event.blockNumber,
          loanApplicationId: loanApplication.id,
        },
      });

      if (existingDistribution) {
        log.debug({ blockNumber: event.blockNumber }, 'Already processed event');
        results.skipped++;
        lastSuccessfulBlock = Math.max(lastSuccessfulBlock, event.blockNumber);
        continue;
      }

      // Check if pool has a contract pool ID
      if (!pool.contractPoolId) {
        log.warn({ poolId: pool.id }, 'Pool missing contractPoolId');
        results.skipped++;
        lastSuccessfulBlock = Math.max(lastSuccessfulBlock, event.blockNumber);
        continue;
      }

      // Distribute yield
      log.info({ interestAmount: interestAmount.toString(), poolName: pool.name }, 'Distributing yield');

      const result = await distributeYield(
        pool.id,
        pool.contractPoolId,
        interestAmount,
        loanApplication.id,
        principalAmount,
        event.blockNumber
      );

      if (result.success) {
        results.distributed++;
        lastSuccessfulBlock = Math.max(lastSuccessfulBlock, event.blockNumber);
        log.info({ txHash: result.txHash }, 'Successfully distributed yield');
      } else {
        results.failed++;
        results.errors.push(result.error || 'Unknown error');
        log.error({ error: result.error }, 'Failed to distribute yield');
        // Don't advance lastSuccessfulBlock past a failed event
      }
    } catch (error) {
      results.failed++;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      results.errors.push(errorMessage);
      log.error({ err: error }, 'Error processing event');
      // Don't advance lastSuccessfulBlock past a failed event
    }
  }

  // Only advance indexer state to the last successfully processed block
  // If all events succeeded, advance to toBlock; if some failed, stop before them
  // so the next run will retry the failed events
  const safeBlock = results.failed > 0 ? lastSuccessfulBlock : toBlock;
  await setLastYieldDistributionBlock(safeBlock);

  log.info({
    ...results,
    fromBlock: lastBlock + 1,
    toBlock,
    durationMs: Date.now() - startTime,
  }, 'Yield distribution completed');

  return NextResponse.json({
    success: true,
    fromBlock: lastBlock + 1,
    toBlock,
    results,
    durationMs: Date.now() - startTime,
  });
}
