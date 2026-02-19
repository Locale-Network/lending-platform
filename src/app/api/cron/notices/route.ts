import { updateLoanInterestRate } from '@/services/contracts/creditTreasuryPool';
import { checkNotice, getLastProcessedIndex, markNoticeProcessed } from '@/services/db/notices';
import prisma from '@prisma/index';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { validateCronSecret } from '@/lib/rate-limit';
import { cronLogger } from '@/lib/logger';

const log = cronLogger.child({ job: 'notice-processor' });

export interface NoticePayload {
  loanId: string;
  interestRate: number;
}

export async function GET(req: NextRequest) {
  // Use standardized cron validation
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lastProcessedIndex = await getLastProcessedIndex();
  const requireApproval = process.env.REQUIRE_RATE_APPROVAL !== 'false'; // Default to true
  const alertThreshold = parseFloat(process.env.RATE_CHANGE_ALERT_THRESHOLD || '2.0');

  log.info({ lastProcessedIndex, requireApproval }, 'Starting notice processor');

  try {
    // Base64 encode the index number for the cursor
    const cursor =
      lastProcessedIndex >= 0
        ? Buffer.from(lastProcessedIndex.toString()).toString('base64')
        : null;

    let query = JSON.stringify({
      query: `query NoticesQuery($cursor: String) {
        notices(first: 2, after: $cursor) {
          edges {
            node {
              index
              input {
                index
              }
              payload
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }`,
      variables: {
        cursor,
      },
    });
    if (!cursor) {
      query = JSON.stringify({
        query: `{
          notices(first: 2) {
            edges {
              node {
                index
                input {
                  index
                }
                payload
              }
            }
          }
        }`,
      });
    }

    const response = await fetch(`${process.env.CARTESI_GRAPHQL_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: query,
    });

    if (!response.ok) {
      log.error({ status: response.status }, 'Failed to fetch notices');
      return NextResponse.json({ success: false }, { status: 500 });
    }

    const result = await response.json();

    if (result.errors) {
      log.error({ errors: result.errors }, 'Failed to fetch notices');
      return NextResponse.json({ success: false }, { status: 500 });
    }

    let processedCount = 0;
    let pendingApprovalCount = 0;
    let autoAppliedCount = 0;

    for (const edge of result.data.notices?.edges || []) {
      const noticeId = edge.node.input.index;

      if (await checkNotice(noticeId)) {
        continue;
      }

      const payload = edge.node.payload;
      const decodedString = Buffer.from(payload.slice(2), 'hex').toString('utf8');

      // SECURITY: Safe JSON.parse with explicit error handling
      let decodedPayload: NoticePayload;
      try {
        decodedPayload = JSON.parse(decodedString);
      } catch (parseError) {
        log.error({ noticeId, decodedString: decodedString.slice(0, 200) }, 'Failed to parse notice payload');
        continue;
      }

      if (!decodedPayload.loanId || typeof decodedPayload.interestRate !== 'number') {
        log.error({ noticeId, decodedPayload }, 'Invalid notice payload - missing required fields');
        continue;
      }

      log.info({ loanId: decodedPayload.loanId, rate: decodedPayload.interestRate }, 'Processing notice');

      // Fetch current loan details
      const loan = await prisma.loanApplication.findUnique({
        where: { id: decodedPayload.loanId },
        select: {
          id: true,
          poolLoans: {
            select: {
              interestRate: true
            },
            orderBy: {
              fundedAt: 'desc'
            },
            take: 1
          }
        }
      });

      if (!loan) {
        log.error({ loanId: decodedPayload.loanId }, 'Loan not found');
        continue;
      }

      const currentRate = loan.poolLoans[0]?.interestRate || 0;
      const proposedRate = decodedPayload.interestRate;
      const rateChangePct = currentRate > 0 ? ((proposedRate - currentRate) / currentRate) * 100 : 0;

      // Update DSCR calculation log
      await prisma.dSCRCalculationLog.updateMany({
        where: {
          loanApplicationId: decodedPayload.loanId,
          status: 'SUBMITTED'
        },
        data: {
          calculatedRate: proposedRate,
          noticeIndex: noticeId,
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      // Approval gate logic
      if (requireApproval) {
        // Create pending rate change for admin approval
        await prisma.pendingRateChange.create({
          data: {
            loanApplicationId: decodedPayload.loanId,
            currentRate,
            proposedRate,
            rateChangePct,
            status: 'PENDING'
          }
        });

        log.info({ currentRate, proposedRate, rateChangePct: rateChangePct.toFixed(2) }, 'Rate change pending approval');
        pendingApprovalCount++;

        // TODO: Send notification to admin if rate change exceeds threshold
        if (Math.abs(rateChangePct) >= alertThreshold) {
          log.warn({ alertThreshold, rateChangePct: rateChangePct.toFixed(2) }, 'Rate change exceeds alert threshold');
          // TODO: Send email/Slack notification
        }

      } else {
        // Auto-apply rate change
        const result = await updateLoanInterestRate(
          decodedPayload.loanId,
          BigInt(Math.floor(proposedRate))
        );

        if (!result.success) {
          log.error({ loanId: decodedPayload.loanId, error: result.error }, 'Failed to update loan');
          continue;
        }

        log.info({ currentRate, proposedRate, txHash: result.txHash }, 'Auto-applied rate change');
        autoAppliedCount++;

        // Log as executed with transaction hash
        await prisma.pendingRateChange.create({
          data: {
            loanApplicationId: decodedPayload.loanId,
            currentRate,
            proposedRate,
            rateChangePct,
            status: 'EXECUTED',
            executedAt: new Date(),
            txHash: result.txHash || null
          }
        });
      }

      await markNoticeProcessed(noticeId);
      processedCount++;
    }

    log.info({ processedCount, pendingApprovalCount, autoAppliedCount }, 'Notice processor complete');

    return NextResponse.json({
      success: true,
      processedCount,
      pendingApprovalCount,
      autoAppliedCount
    });
  } catch (e) {
    log.error({ err: e }, 'Notice processor failed');
  }

  return NextResponse.json({ success: false }, { status: 500 });
}
