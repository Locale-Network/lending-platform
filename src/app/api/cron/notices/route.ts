import { updateLoanInterestRate } from '@/services/contracts/simpleLoanPool';
import { checkNotice, getLastProcessedIndex, markNoticeProcessed } from '@/services/db/notices';
import prisma from '@prisma/index';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export interface NoticePayload {
  loanId: string;
  interestRate: number;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lastProcessedIndex = await getLastProcessedIndex();
  const requireApproval = process.env.REQUIRE_RATE_APPROVAL !== 'false'; // Default to true
  const alertThreshold = parseFloat(process.env.RATE_CHANGE_ALERT_THRESHOLD || '2.0');

  console.log('[Notice Processor] Starting, last processed:', lastProcessedIndex);
  console.log('[Notice Processor] Approval required:', requireApproval);

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
      console.error('Failed to fetch notices', response);
      return NextResponse.json({ success: false }, { status: 500 });
    }

    const result = await response.json();

    if (result.errors) {
      console.error('Failed to fetch notices', result.errors);
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
      const decodedPayload: NoticePayload = JSON.parse(decodedString);

      console.log(`[Notice Processor] Processing notice for loan ${decodedPayload.loanId}, rate: ${decodedPayload.interestRate}`);

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
        console.error(`[Notice Processor] Loan ${decodedPayload.loanId} not found`);
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

        console.log(`[Notice Processor] Rate change pending approval: ${currentRate} -> ${proposedRate} (${rateChangePct.toFixed(2)}%)`);
        pendingApprovalCount++;

        // TODO: Send notification to admin if rate change exceeds threshold
        if (Math.abs(rateChangePct) >= alertThreshold) {
          console.warn(`[Notice Processor] ⚠️  Rate change exceeds alert threshold (${alertThreshold}%): ${rateChangePct.toFixed(2)}%`);
          // TODO: Send email/Slack notification
        }

      } else {
        // Auto-apply rate change
        const result = await updateLoanInterestRate(
          decodedPayload.loanId,
          BigInt(Math.floor(proposedRate))
        );

        if (!result.success) {
          console.error(`[Notice Processor] Failed to update loan ${decodedPayload.loanId}: ${result.error}`);
          continue;
        }

        console.log(`[Notice Processor] Auto-applied rate change: ${currentRate} -> ${proposedRate}, txHash: ${result.txHash}`);
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

    console.log(`[Notice Processor] Complete: ${processedCount} notices processed, ${pendingApprovalCount} pending approval, ${autoAppliedCount} auto-applied`);

    return NextResponse.json({
      success: true,
      processedCount,
      pendingApprovalCount,
      autoAppliedCount
    });
  } catch (e) {
    console.error(e);
  }

  return NextResponse.json({ success: false }, { status: 500 });
}
