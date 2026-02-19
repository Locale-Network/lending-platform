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
import { calculateInterestRateFromDSCR, DEFAULT_INTEREST_RATE_PERCENT } from '@/lib/interest-rate';
import { subMonths } from 'date-fns';
import { FundingUrgencyToTermMonths, type FundingUrgencyType } from '@/app/borrower/loans/apply/form-schema';
import { getExplorerUrl } from '@/lib/explorer';

// In-memory cache for DSCR status to avoid repeated blockchain RPC calls
// Cache entries expire after 30 seconds
interface CacheEntry {
  data: object;
  timestamp: number;
}
const dscrCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000; // 30 seconds

// Local Anvil chain for development
const anvil: Chain = {
  id: 31337,
  name: 'Anvil Local',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
  testnet: true,
};

const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID ? parseInt(process.env.NEXT_PUBLIC_CHAIN_ID, 10) : undefined;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const SIMPLE_LOAN_POOL_ADDRESS = (process.env.SIMPLE_LOAN_POOL_ADDRESS || process.env.NEXT_PUBLIC_LOAN_POOL_ADDRESS) as `0x${string}`;

const SIMPLE_LOAN_POOL_ABI = parseAbi([
  'function hasZkFetchVerifiedDscr(bytes32 _loanId) external view returns (bool)',
  'function getZkFetchDscrResult(bytes32 _loanId) external view returns (uint256 dscrValue, uint256 interestRate, bytes32 proofHash, uint256 verifiedAt)',
]);

function getChain(): Chain {
  if (!CHAIN_ID) {
    throw new Error('NEXT_PUBLIC_CHAIN_ID not configured');
  }
  switch (CHAIN_ID) {
    case 31337: return anvil;
    case 421614: return arbitrumSepolia;
    case 42161: return arbitrum;
    default: throw new Error(`Unsupported NEXT_PUBLIC_CHAIN_ID: ${CHAIN_ID}`);
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

    // Check cache first to avoid slow blockchain RPC calls
    const cacheKey = `${loanApplicationId}:${accountAddress.toLowerCase()}`;
    const cached = dscrCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

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
    // Use date-fns subMonths for correct month arithmetic (handles year boundaries properly)
    const windowStartDate = subMonths(new Date(), DSCR_WINDOW_MONTHS);

    // Verify access to loan application
    const loanApplication = await prisma.loanApplication.findFirst({
      where: whereClause,
      include: {
        transactions: {
          where: {
            isDeleted: false,
            transactionId: { not: null }, // Only include transactions with valid IDs
            date: { gte: windowStartDate }, // Only include transactions from rolling window
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

    // Plaid transaction sign convention (for /transactions/get and /transactions/sync):
    // - POSITIVE amounts = money OUT (expenses, debits, purchases)
    // - NEGATIVE amounts = money IN (income, deposits, refunds)
    // See: https://plaid.com/docs/api/products/transactions/#transactionsget
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
    // USDC has 6 decimals, so we need to scale the BigInt
    // SAFE RANGE: With 6 decimals, Number conversion is safe up to ~$9 trillion (well beyond practical loan sizes)
    // NOTE: If supporting 18-decimal tokens, consider dividing BigInt first: Number(rawAmount / 10n ** BigInt(decimals))
    const TOKEN_DECIMALS = 6;
    const rawLoanAmount = loanApplication.loanAmount;
    if (!rawLoanAmount) {
      return NextResponse.json({
        verified: false,
        error: 'Loan amount not set',
      }, { status: 400 });
    }
    const loanAmount = Number(rawLoanAmount) / Math.pow(10, TOKEN_DECIMALS);

    // Calculate monthly debt service using proper amortization formula
    // Term comes from borrower's funding urgency selection (maps to 12/24/36 months)
    const termMonths = loanApplication.fundingUrgency
      ? FundingUrgencyToTermMonths[loanApplication.fundingUrgency as FundingUrgencyType] || 24
      : 24;
    const annualRate = DEFAULT_INTEREST_RATE_PERCENT / 100;
    const monthlyRate = annualRate / 12;
    const monthlyDebtService = loanAmount > 0
      ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
        (Math.pow(1 + monthlyRate, termMonths) - 1)
      : 0;

    const dscrValue = monthlyDebtService > 0 ? monthlyNoi / monthlyDebtService : 0;

    // Calculate base interest rate based on DSCR using shared utility
    // Rate tiers based on DSCR (in basis points) - SBA-aligned 9-15% range
    const baseInterestRate = calculateInterestRateFromDSCR(dscrValue);

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
          // Cartesi returns Unix seconds, relay fallback returns milliseconds
          // If timestamp < 1e12, it's seconds — convert to milliseconds
          verifiedAt: new Date(
            notice.calculated_at < 1e12 ? notice.calculated_at * 1000 : notice.calculated_at
          ).toISOString(),
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
    if (proofHash) {
      try {
        explorerUrl = getExplorerUrl('address', SIMPLE_LOAN_POOL_ADDRESS);
      } catch {
        // Unsupported chain ID
      }
    }

    const responseData = {
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
    };

    // Cache the successful response
    dscrCache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    // Clean up old cache entries periodically (every 100 requests)
    if (dscrCache.size > 100) {
      const now = Date.now();
      for (const [key, entry] of dscrCache.entries()) {
        if (now - entry.timestamp > CACHE_TTL_MS) {
          dscrCache.delete(key);
        }
      }
    }

    return NextResponse.json(responseData);
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
