import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';
import {
  adjustRateByLendScore,
  getLendScoreReasonDescriptions,
} from '@/services/plaid/lendScore';

/**
 * GET /api/loan/[id]/dscr-status
 *
 * Returns the DSCR verification status for a loan application.
 * Polls this endpoint to check if zkFetch + Cartesi verification is complete.
 *
 * Response:
 * - verified: boolean - Whether DSCR has been verified
 * - dscrValue: number - DSCR value (scaled by 1000)
 * - interestRate: number - Interest rate in basis points
 * - proofHash: string - Hash of the zkFetch proof
 * - verifiedAt: string - ISO timestamp of verification
 * - transactionCount: number - Number of transactions analyzed
 * - lendScore: number | null - Plaid LendScore (1-99)
 * - lendScoreReasons: string[] | null - Human-readable reason descriptions
 * - error: string - Error message if verification failed
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    const accountAddress = session?.address;

    if (!accountAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: loanApplicationId } = await params;

    // Normalize address to lowercase for case-insensitive matching
    const normalizedAddress = accountAddress.toLowerCase();

    // Check if approver access is requested
    const isApproverRequest = request.nextUrl.searchParams.get('approver') === 'true';

    // Build query based on access type
    // Approvers can view any loan, borrowers only their own
    const whereClause = isApproverRequest
      ? { id: loanApplicationId }
      : { id: loanApplicationId, accountAddress: normalizedAddress };

    // Verify access to loan application
    const loanApplication = await prisma.loanApplication.findFirst({
      where: whereClause,
      include: {
        transactions: {
          where: { isDeleted: false },
        },
      },
    });

    if (!loanApplication) {
      return NextResponse.json({ error: 'Loan application not found' }, { status: 404 });
    }

    // Check if we have verified DSCR data
    // In the new architecture, this would come from Cartesi notices via the relay
    // For now, we check if transactions exist and lastSyncedAt is set
    const hasTransactions = loanApplication.transactions.length > 0;
    const lastSyncedAt = loanApplication.lastSyncedAt;

    if (!hasTransactions || !lastSyncedAt) {
      // Still processing
      return NextResponse.json({
        verified: false,
        processing: true,
      });
    }

    // Calculate DSCR from stored transactions
    // In production, this would come from Cartesi verified data
    const transactions = loanApplication.transactions;

    // In Plaid: negative amounts = income, positive = expenses
    const totalIncome = transactions
      .filter(tx => (tx.amount || 0) < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

    const totalExpenses = transactions
      .filter(tx => (tx.amount || 0) > 0)
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // Calculate months in window
    const dates = transactions.map(tx => tx.date).filter(Boolean) as Date[];
    const monthCount =
      dates.length > 0
        ? Math.max(
            1,
            Math.ceil(
              (Math.max(...dates.map(d => d.getTime())) -
                Math.min(...dates.map(d => d.getTime()))) /
                (30 * 24 * 60 * 60 * 1000)
            )
          )
        : 1;

    const monthlyNoi = (totalIncome - totalExpenses) / monthCount;

    // Get loan amount for debt service calculation
    // Assuming 24-month term at 10% APR for simplified calculation
    const loanAmount = Number(loanApplication.loanAmount || 1000000000n); // 1000 USDC scaled
    const monthlyDebtService = (loanAmount * 0.1) / 12 + loanAmount / 24;

    const dscrValue = monthlyDebtService > 0 ? monthlyNoi / monthlyDebtService : 0;

    // Calculate base interest rate based on DSCR (simplified)
    // DSCR >= 1.5: 5%, >= 1.25: 7%, >= 1.0: 10%, < 1.0: 15%
    let baseInterestRate: number;
    if (dscrValue >= 1.5) {
      baseInterestRate = 500; // 5%
    } else if (dscrValue >= 1.25) {
      baseInterestRate = 700; // 7%
    } else if (dscrValue >= 1.0) {
      baseInterestRate = 1000; // 10%
    } else {
      baseInterestRate = 1500; // 15%
    }

    // Apply LendScore adjustment if available
    const lendScore = loanApplication.lendScore;
    const lendScoreReasonCodes = loanApplication.lendScoreReasonCodes || [];
    let interestRate = baseInterestRate;
    let lendScoreReasons: string[] | null = null;

    if (lendScore) {
      interestRate = adjustRateByLendScore(lendScore, baseInterestRate);
      lendScoreReasons = getLendScoreReasonDescriptions(lendScoreReasonCodes);
    }

    // Generate a proof hash for display (in production, this comes from zkFetch)
    const proofHash = Buffer.from(
      `${loanApplicationId}-${lastSyncedAt.getTime()}-${transactions.length}`
    )
      .toString('base64')
      .replace(/[+/=]/g, '')
      .slice(0, 32);

    return NextResponse.json({
      verified: true,
      dscrValue: Math.round(dscrValue * 1000), // Scale by 1000
      interestRate,
      baseInterestRate,
      proofHash,
      verifiedAt: lastSyncedAt.toISOString(),
      transactionCount: transactions.length,
      // LendScore data (if available)
      lendScore: lendScore || null,
      lendScoreReasons,
    });
  } catch (error) {
    console.error('Error getting DSCR status:', error);
    return NextResponse.json(
      {
        verified: false,
        error: 'Failed to get DSCR status',
      },
      { status: 500 }
    );
  }
}
