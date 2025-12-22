import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';
import {
  adjustRateByLendScore,
  getLendScoreReasonDescriptions,
} from '@/services/plaid/lendScore';
import { fetchNoticeByLoanId } from '@/services/relay';
import { createPublicClient, http, parseAbi, type Chain } from 'viem';
import { arbitrum, arbitrumSepolia } from 'viem/chains';

// Local Anvil chain for development
const anvil: Chain = {
  id: 31337,
  name: 'Anvil Local',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
  testnet: true,
};

const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '421614', 10);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';
const SIMPLE_LOAN_POOL_ADDRESS = (process.env.SIMPLE_LOAN_POOL_ADDRESS || process.env.NEXT_PUBLIC_LOAN_POOL_ADDRESS) as `0x${string}`;

const SIMPLE_LOAN_POOL_ABI = parseAbi([
  'function hasZkFetchVerifiedDscr(bytes32 _loanId) external view returns (bool)',
  'function getZkFetchDscrResult(bytes32 _loanId) external view returns (uint256 dscrValue, uint256 interestRate, bytes32 proofHash, uint256 verifiedAt)',
]);

function getChain(): Chain {
  switch (CHAIN_ID) {
    case 31337: return anvil;
    case 421614: return arbitrumSepolia;
    case 42161:
    default: return arbitrum;
  }
}

function loanIdToBytes32(loanId: string): `0x${string}` {
  if (loanId.startsWith('0x')) {
    const hex = loanId.slice(2).padEnd(64, '0');
    return `0x${hex}` as `0x${string}`;
  }
  const hex = Buffer.from(loanId).toString('hex').padEnd(64, '0');
  return `0x${hex}` as `0x${string}`;
}

/**
 * Decode on-chain proof hash (bytes32 stored as hex-encoded ASCII) to raw hex string
 * On-chain: 0x373637663865383538663835613538613461... = hex-encoded "767f8e858f85a58a4a..."
 * Returns: "767f8e858f85a58a4a..."
 */
function decodeOnChainProofHash(onchainHash: `0x${string}`): string {
  const hexStr = onchainHash.slice(2);
  let decoded = '';
  for (let i = 0; i < hexStr.length; i += 2) {
    const charCode = parseInt(hexStr.slice(i, i + 2), 16);
    if (charCode === 0) break; // Stop at null terminator
    decoded += String.fromCharCode(charCode);
  }
  return decoded;
}

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

    // Check if approver/admin access is requested
    const isApproverRequest = request.nextUrl.searchParams.get('approver') === 'true';

    // Check if user is an admin (admins can view any loan)
    const isAdmin = session.user?.role === 'ADMIN';

    // Build query based on access type
    // Approvers and Admins can view any loan, borrowers only their own
    const whereClause = (isApproverRequest || isAdmin)
      ? { id: loanApplicationId }
      : { id: loanApplicationId, accountAddress: normalizedAddress };

    // Use a rolling 3-month window for DSCR calculation (matches zkFetchWrapper)
    const DSCR_WINDOW_MONTHS = 3;
    const windowStartDate = new Date();
    windowStartDate.setMonth(windowStartDate.getMonth() - DSCR_WINDOW_MONTHS);

    // Verify access to loan application
    const loanApplication = await prisma.loanApplication.findFirst({
      where: whereClause,
      include: {
        transactions: {
          where: {
            isDeleted: false,
            transactionId: { not: null }, // Only include transactions with valid IDs
            date: { gte: windowStartDate }, // Only include transactions from last 6 months
          },
          distinct: ['transactionId'], // Prevent duplicate counting
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

    // Calculate base interest rate based on DSCR (matches relay service calculateInterestRate)
    // Rate tiers based on DSCR (in basis points) - SBA-aligned 9-15% range
    let baseInterestRate: number;
    if (dscrValue >= 2.0) {
      baseInterestRate = 900; // 9% - excellent creditworthiness
    } else if (dscrValue >= 1.5) {
      baseInterestRate = 1050; // 10.5% - strong creditworthiness
    } else if (dscrValue >= 1.25) {
      baseInterestRate = 1200; // 12% - good creditworthiness
    } else if (dscrValue >= 1.0) {
      baseInterestRate = 1350; // 13.5% - acceptable creditworthiness
    } else {
      baseInterestRate = 1500; // 15% - high risk
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

    // Step 1: Try to get REAL proof data from on-chain first (most authoritative)
    let onchainProof = null;
    let onchainVerified = false;

    try {
      const chain = getChain();
      const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
      const loanIdBytes = loanIdToBytes32(loanApplicationId);

      // Check if loan has verified DSCR on-chain
      const hasVerified = await publicClient.readContract({
        address: SIMPLE_LOAN_POOL_ADDRESS,
        abi: SIMPLE_LOAN_POOL_ABI,
        functionName: 'hasZkFetchVerifiedDscr',
        args: [loanIdBytes],
      }) as boolean;

      if (hasVerified) {
        const result = await publicClient.readContract({
          address: SIMPLE_LOAN_POOL_ADDRESS,
          abi: SIMPLE_LOAN_POOL_ABI,
          functionName: 'getZkFetchDscrResult',
          args: [loanIdBytes],
        }) as [bigint, bigint, `0x${string}`, bigint];

        // Decode the on-chain proof hash from hex-encoded ASCII to raw hex
        const decodedProofHash = decodeOnChainProofHash(result[2]);

        onchainProof = {
          dscrValue: Number(result[0]),
          interestRate: Number(result[1]),
          proofHash: decodedProofHash,
          verifiedAt: new Date(Number(result[3]) * 1000).toISOString(),
        };
        onchainVerified = true;
      }
    } catch (error) {
      console.log('[DSCR Status] On-chain check failed, falling back to Cartesi:', error);
    }

    // Step 2: If not on-chain, check Cartesi GraphQL for pending notice
    let cartesiProof = null;

    try {
      const notice = await fetchNoticeByLoanId(loanApplicationId);
      if (notice) {
        cartesiProof = {
          dscrValue: Math.round(parseFloat(notice.dscr_value) * 1000),
          proofHash: notice.zkfetch_proof_hash,
          verifiedAt: new Date(notice.calculated_at).toISOString(),
          meetsThreshold: notice.meets_threshold,
          verificationId: notice.verification_id,
          pendingRelay: true, // Indicates this is in Cartesi but not yet relayed to chain
        };
      }
    } catch (error) {
      console.log('[DSCR Status] Cartesi check failed:', error);
    }

    // Determine final proof data - prefer on-chain if available
    const finalProof = onchainProof || cartesiProof;
    const proofHash = finalProof?.proofHash || null;

    // Build explorer URL for the proof
    let explorerUrl = null;
    if (proofHash && CHAIN_ID === 421614) {
      explorerUrl = `https://sepolia.arbiscan.io/address/${SIMPLE_LOAN_POOL_ADDRESS}`;
    } else if (proofHash && CHAIN_ID === 42161) {
      explorerUrl = `https://arbiscan.io/address/${SIMPLE_LOAN_POOL_ADDRESS}`;
    }

    return NextResponse.json({
      verified: true,
      dscrValue: finalProof?.dscrValue || Math.round(dscrValue * 1000),
      interestRate: finalProof?.interestRate || interestRate,
      baseInterestRate,
      proofHash,
      verifiedAt: finalProof?.verifiedAt || lastSyncedAt.toISOString(),
      transactionCount: transactions.length,
      // LendScore data (if available)
      lendScore: lendScore || null,
      lendScoreReasons,
      // Verification source details
      proofSource: onchainVerified ? 'onchain' : cartesiProof ? 'cartesi' : 'local',
      onchainVerified,
      pendingRelay: cartesiProof?.pendingRelay || false,
      explorerUrl,
      contractAddress: SIMPLE_LOAN_POOL_ADDRESS,
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
