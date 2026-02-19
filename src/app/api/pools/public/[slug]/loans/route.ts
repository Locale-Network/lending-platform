import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchCartesiNotices, parseNoticePayload, type DscrVerifiedNotice } from '@/services/relay';
import { createPublicClient, http, parseAbi, type Chain } from 'viem';
import { arbitrum, arbitrumSepolia } from 'viem/chains';
import { calculateInterestRateFromDSCR } from '@/lib/interest-rate';
import { checkRateLimit, getClientIp, rateLimits, rateLimitHeaders } from '@/lib/rate-limit';
import { getExplorerUrl } from '@/lib/explorer';

// In-memory cache for pool loan metrics (30 second TTL)
interface CacheEntry {
  data: object;
  timestamp: number;
}
const loansCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

/**
 * Public Loans API - Exposes loan metrics for investor transparency
 *
 * Data Source: Cartesi-primary for maximum transparency
 * - DSCR, interest rate, proof hash from Cartesi/on-chain
 * - LendScore from PostgreSQL (Plaid-sourced)
 *
 * Privacy: Excludes borrower identity, loan amounts, transaction details
 */

// Chain configuration
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

function decodeOnChainProofHash(onchainHash: `0x${string}`): string {
  const hexStr = onchainHash.slice(2);
  let decoded = '';
  for (let i = 0; i < hexStr.length; i += 2) {
    const charCode = parseInt(hexStr.slice(i, i + 2), 16);
    if (charCode === 0) break;
    decoded += String.fromCharCode(charCode);
  }
  return decoded;
}

function getExplorerUrlSafe(type: 'address' | 'tx', value: string): string | null {
  try {
    return getExplorerUrl(type, value);
  } catch {
    return null;
  }
}

// Health label helpers
function getLendScoreHealth(score: number | null): string {
  if (score === null) return 'Unknown';
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

function getDscrHealth(dscr: number): string {
  if (dscr >= 2.0) return 'Excellent';
  if (dscr >= 1.5) return 'Good';
  if (dscr >= 1.25) return 'Adequate';
  if (dscr >= 1.0) return 'Marginal';
  return 'Weak';
}

// Calculate interest rate from DSCR using shared utility
function calculateInterestRate(dscr: number): number {
  return calculateInterestRateFromDSCR(dscr);
}

interface PublicLoanMetrics {
  id: string;
  displayLabel: string;
  lendScore: number | null;
  lendScoreHealth: string;
  dscr: number;
  dscrHealth: string;
  interestRate: number;
  interestRateFormatted: string;
  status: string;
  industry: string;
  proofHash: string;
  verifiedAt: string | null;
  verifiedOnChain: boolean;
  proofSource: 'onchain' | 'cartesi' | 'local';
  explorerUrl: string | null;
}

/**
 * GET /api/pools/public/[slug]/loans
 *
 * Returns sanitized loan metrics for a pool, pulling from Cartesi for transparency.
 * Investors can verify proof hashes independently.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // SECURITY: Rate limiting on public data access to prevent enumeration attacks
    const clientIp = await getClientIp();
    const rateLimitResult = await checkRateLimit(
      `public-loans:${clientIp}`,
      rateLimits.api // 100 requests per minute
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    const { slug } = await params;

    // Check cache first
    const cached = loansCache.get(slug);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    // Find the pool by slug
    const pool = await prisma.loanPool.findUnique({
      where: { slug },
      select: { id: true, name: true, status: true },
    });

    if (!pool) {
      return NextResponse.json(
        { error: 'Pool not found' },
        { status: 404 }
      );
    }

    // Get all loans funded by this pool from PoolLoan records
    const poolLoans = await prisma.poolLoan.findMany({
      where: { poolId: pool.id },
      include: {
        loanApplication: {
          select: {
            id: true,
            status: true,
            businessPrimaryIndustry: true,
            lendScore: true,
            // Exclude: businessLegalName, ein, accountAddress, loanAmount
          },
        },
      },
    });

    // Also check for DISBURSED loans without PoolLoan records (for backwards compatibility)
    const disbursedLoansWithoutPoolLoan = await prisma.loanApplication.findMany({
      where: {
        status: 'DISBURSED',
        id: {
          notIn: poolLoans.map(pl => pl.loanApplicationId),
        },
      },
      select: {
        id: true,
        status: true,
        businessPrimaryIndustry: true,
        lendScore: true,
      },
    });

    // Combine both sources
    const allLoanApplications = [
      ...poolLoans.map(pl => pl.loanApplication),
      ...disbursedLoansWithoutPoolLoan,
    ];

    if (allLoanApplications.length === 0) {
      return NextResponse.json({
        pool: { id: pool.id, name: pool.name, status: pool.status },
        loans: [],
        totalCount: 0,
        dataSource: 'none',
      });
    }

    // Fetch all Cartesi notices for DSCR data
    let cartesiNotices: DscrVerifiedNotice[] = [];
    let dataSource: 'cartesi' | 'fallback' = 'cartesi';

    try {
      const rawNotices = await fetchCartesiNotices(100);
      cartesiNotices = rawNotices
        .map(n => parseNoticePayload(n.payload))
        .filter((n): n is DscrVerifiedNotice => n !== null);
    } catch (error) {
      console.error('[Public Loans] Failed to fetch Cartesi notices:', error);
      dataSource = 'fallback';
    }

    // Create a map of loan ID -> Cartesi notice
    const cartesiMap = new Map<string, DscrVerifiedNotice>();
    for (const notice of cartesiNotices) {
      // Keep the latest notice per loan
      const existing = cartesiMap.get(notice.loan_id);
      if (!existing || notice.calculated_at > existing.calculated_at) {
        cartesiMap.set(notice.loan_id, notice);
      }
    }

    // Set up on-chain client for verification
    const chain = getChain();
    const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });

    // Build public loan metrics
    const loans: PublicLoanMetrics[] = [];
    let loanIndex = 1;

    for (const app of allLoanApplications) {
      const loanId = app.id;

      // Default values
      let dscr = 0;
      let interestRate = 1500; // Default 15%
      let proofHash = '';
      let verifiedAt: string | null = null;
      let verifiedOnChain = false;
      let proofSource: 'onchain' | 'cartesi' | 'local' = 'local';

      // Try on-chain first (most authoritative)
      try {
        const loanIdBytes = loanIdToBytes32(loanId);
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

          dscr = Number(result[0]) / 1000;
          interestRate = Number(result[1]);
          proofHash = decodeOnChainProofHash(result[2]);
          verifiedAt = new Date(Number(result[3]) * 1000).toISOString();
          verifiedOnChain = true;
          proofSource = 'onchain';
        }
      } catch (error) {
        // On-chain check failed, continue to Cartesi
        console.log(`[Public Loans] On-chain check failed for loan ${loanId}:`, error);
      }

      // Fall back to Cartesi if not on-chain
      if (!verifiedOnChain) {
        const cartesiNotice = cartesiMap.get(loanId);
        if (cartesiNotice) {
          dscr = parseFloat(cartesiNotice.dscr_value);
          interestRate = calculateInterestRate(dscr);
          proofHash = cartesiNotice.zkfetch_proof_hash;
          verifiedAt = new Date(cartesiNotice.calculated_at * 1000).toISOString();
          proofSource = 'cartesi';
        }
      }

      // Create display label from industry (anonymized)
      const industry = app.businessPrimaryIndustry || 'Business';
      const displayLabel = `${industry} #${loanIndex}`;

      loans.push({
        id: loanId,
        displayLabel,
        lendScore: app.lendScore,
        lendScoreHealth: getLendScoreHealth(app.lendScore),
        dscr: Math.round(dscr * 100) / 100, // Round to 2 decimal places
        dscrHealth: getDscrHealth(dscr),
        interestRate,
        interestRateFormatted: `${(interestRate / 100).toFixed(2)}%`,
        status: app.status,
        industry,
        proofHash,
        verifiedAt,
        verifiedOnChain,
        proofSource,
        explorerUrl: verifiedOnChain ? getExplorerUrlSafe('address', SIMPLE_LOAN_POOL_ADDRESS) : null,
      });

      loanIndex++;
    }

    const responseData = {
      pool: {
        id: pool.id,
        name: pool.name,
        status: pool.status,
      },
      loans,
      totalCount: loans.length,
      dataSource,
      contractAddress: SIMPLE_LOAN_POOL_ADDRESS,
      contractExplorerUrl: getExplorerUrlSafe('address', SIMPLE_LOAN_POOL_ADDRESS),
    };

    // Cache the response
    loansCache.set(slug, { data: responseData, timestamp: Date.now() });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('[Public Loans] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pool loans' },
      { status: 500 }
    );
  }
}
