import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchCartesiNotices, parseNoticePayload, type DscrVerifiedNotice } from '@/services/relay';
import { createPublicClient, http, parseAbi, type Chain } from 'viem';
import { arbitrum, arbitrumSepolia } from 'viem/chains';
import { BorrowerType } from '@prisma/client';
import {
  getCachedCompositeMetrics,
  getConcentrationLevel,
  getRiskTierBadgeColor,
  type RiskTier,
  type ConcentrationLevel,
} from '@/services/risk';
import { checkRateLimit, getClientIp, rateLimitHeaders, rateLimits } from '@/lib/rate-limit';

// In-memory cache for risk metrics (30 second TTL)
interface CacheEntry {
  data: object;
  timestamp: number;
}
const riskMetricsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

/**
 * Pool Risk Aggregates API - Provides pool-level risk metrics for investors
 *
 * Calculates aggregates from individual loan data sourced from Cartesi.
 * Uses simple averages (not weighted) since loan amounts are hidden for privacy.
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

// Calculate interest rate from DSCR (same as relay service)
function calculateInterestRate(dscr: number): number {
  if (dscr >= 2.0) return 900;
  if (dscr >= 1.5) return 1050;
  if (dscr >= 1.25) return 1200;
  if (dscr >= 1.0) return 1350;
  return 1500;
}

interface LoanDataPoint {
  loanId: string;
  dscr: number;
  lendScore: number | null;
  interestRate: number;
  industry: string;
  verifiedOnChain: boolean;
}

interface PoolRiskMetrics {
  // LendScore Aggregates
  avgLendScore: number | null;
  lendScoreDistribution: {
    excellent: number; // 80-99
    good: number;      // 60-79
    fair: number;      // 40-59
    poor: number;      // 1-39
  };

  // DSCR Aggregates
  avgDscr: number;
  dscrDistribution: {
    excellent: number; // >= 2.0
    good: number;      // 1.5-1.99
    adequate: number;  // 1.25-1.49
    marginal: number;  // 1.0-1.24
    weak: number;      // < 1.0
  };

  // Portfolio Metrics
  totalActiveLoans: number;
  avgInterestRate: number;
  avgInterestRateFormatted: string;

  // Diversification
  industryBreakdown: Record<string, number>;

  // Risk Indicators
  loansVerifiedOnChain: number;
  verificationRate: number;
}

// Composite metrics for multi-borrower pools (weighted averages, HHI, composite score)
interface CompositeMetrics {
  compositeRiskScore: number;
  riskTier: RiskTier;
  riskTierBadgeColor: string;

  weightedAvgDscr: number;
  weightedAvgRate: number;
  weightedAvgRateFormatted: string;
  weightedAvgLendScore: number | null;

  diversificationScore: number;
  hhiIndex: number;
  borrowerConcentration: ConcentrationLevel;

  componentScores: {
    dscr: { weight: number; score: number; contribution: number };
    lendScore: { weight: number; score: number; contribution: number };
    diversification: { weight: number; score: number; contribution: number };
    rate: { weight: number; score: number; contribution: number };
  };

  calculatedAt: string;
}

/**
 * GET /api/pools/public/[slug]/risk-metrics
 *
 * Returns aggregated risk metrics for a pool.
 * All data sourced from Cartesi/on-chain for transparency.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // SECURITY: Rate limiting on public endpoint to prevent abuse
    const clientIp = await getClientIp();
    const rateLimitResult = await checkRateLimit(`public-risk-metrics:${clientIp}`, rateLimits.api);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    const { slug } = await params;

    // Check cache first
    const cached = riskMetricsCache.get(slug);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    // Find the pool by slug
    const pool = await prisma.loanPool.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        status: true,
        borrowerType: true,
        // Cached composite metrics
        compositeRiskScore: true,
        compositeRiskTier: true,
        weightedAvgDscr: true,
        weightedAvgRate: true,
        weightedAvgLendScore: true,
        diversificationScore: true,
        hhiIndex: true,
        compositeCalculatedAt: true,
      },
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

    // Combine both sources - wrap standalone loans to match the poolLoans structure
    const allLoanApplications = [
      ...poolLoans.map(pl => pl.loanApplication),
      ...disbursedLoansWithoutPoolLoan,
    ];

    if (allLoanApplications.length === 0) {
      return NextResponse.json({
        pool: { id: pool.id, name: pool.name, status: pool.status },
        riskMetrics: null,
        message: 'No loans in this pool yet',
      });
    }

    // Fetch Cartesi notices for DSCR data
    let cartesiNotices: DscrVerifiedNotice[] = [];
    try {
      const rawNotices = await fetchCartesiNotices(100);
      cartesiNotices = rawNotices
        .map(n => parseNoticePayload(n.payload))
        .filter((n): n is DscrVerifiedNotice => n !== null);
    } catch (error) {
      console.error('[Risk Metrics] Failed to fetch Cartesi notices:', error);
    }

    // Create a map of loan ID -> Cartesi notice
    const cartesiMap = new Map<string, DscrVerifiedNotice>();
    for (const notice of cartesiNotices) {
      const existing = cartesiMap.get(notice.loan_id);
      if (!existing || notice.calculated_at > existing.calculated_at) {
        cartesiMap.set(notice.loan_id, notice);
      }
    }

    // Set up on-chain client
    const chain = getChain();
    const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });

    // Collect data points for all loans
    const loanDataPoints: LoanDataPoint[] = [];

    for (const app of allLoanApplications) {
      const loanId = app.id;

      let dscr = 0;
      let interestRate = 1500;
      let verifiedOnChain = false;

      // Try on-chain first
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
          verifiedOnChain = true;
        }
      } catch (error) {
        // On-chain check failed
      }

      // Fall back to Cartesi
      if (!verifiedOnChain) {
        const cartesiNotice = cartesiMap.get(loanId);
        if (cartesiNotice) {
          dscr = parseFloat(cartesiNotice.dscr_value);
          interestRate = calculateInterestRate(dscr);
        }
      }

      loanDataPoints.push({
        loanId,
        dscr,
        lendScore: app.lendScore,
        interestRate,
        industry: app.businessPrimaryIndustry || 'Other',
        verifiedOnChain,
      });
    }

    // Calculate aggregates
    const loansWithDscr = loanDataPoints.filter(l => l.dscr > 0);
    const loansWithLendScore = loanDataPoints.filter(l => l.lendScore !== null);

    // DSCR aggregates
    const avgDscr = loansWithDscr.length > 0
      ? loansWithDscr.reduce((sum, l) => sum + l.dscr, 0) / loansWithDscr.length
      : 0;

    const dscrDistribution = {
      excellent: loansWithDscr.filter(l => l.dscr >= 2.0).length,
      good: loansWithDscr.filter(l => l.dscr >= 1.5 && l.dscr < 2.0).length,
      adequate: loansWithDscr.filter(l => l.dscr >= 1.25 && l.dscr < 1.5).length,
      marginal: loansWithDscr.filter(l => l.dscr >= 1.0 && l.dscr < 1.25).length,
      weak: loansWithDscr.filter(l => l.dscr < 1.0).length,
    };

    // LendScore aggregates
    const avgLendScore = loansWithLendScore.length > 0
      ? loansWithLendScore.reduce((sum, l) => sum + (l.lendScore ?? 0), 0) / loansWithLendScore.length
      : null;

    const lendScoreDistribution = {
      excellent: loansWithLendScore.filter(l => (l.lendScore ?? 0) >= 80).length,
      good: loansWithLendScore.filter(l => (l.lendScore ?? 0) >= 60 && (l.lendScore ?? 0) < 80).length,
      fair: loansWithLendScore.filter(l => (l.lendScore ?? 0) >= 40 && (l.lendScore ?? 0) < 60).length,
      poor: loansWithLendScore.filter(l => (l.lendScore ?? 0) < 40).length,
    };

    // Interest rate average
    const avgInterestRate = loanDataPoints.length > 0
      ? loanDataPoints.reduce((sum, l) => sum + l.interestRate, 0) / loanDataPoints.length
      : 0;

    // Industry breakdown (percentage)
    const industryCount: Record<string, number> = {};
    for (const loan of loanDataPoints) {
      industryCount[loan.industry] = (industryCount[loan.industry] || 0) + 1;
    }
    const industryBreakdown: Record<string, number> = {};
    for (const [industry, count] of Object.entries(industryCount)) {
      industryBreakdown[industry] = Math.round((count / loanDataPoints.length) * 100);
    }

    // Verification metrics
    const loansVerifiedOnChain = loanDataPoints.filter(l => l.verifiedOnChain).length;
    const verificationRate = loanDataPoints.length > 0
      ? Math.round((loansVerifiedOnChain / loanDataPoints.length) * 100)
      : 0;

    const riskMetrics: PoolRiskMetrics = {
      avgLendScore: avgLendScore !== null ? Math.round(avgLendScore) : null,
      lendScoreDistribution,
      avgDscr: Math.round(avgDscr * 100) / 100,
      dscrDistribution,
      totalActiveLoans: loanDataPoints.length,
      avgInterestRate: Math.round(avgInterestRate),
      avgInterestRateFormatted: `${(avgInterestRate / 100).toFixed(2)}%`,
      industryBreakdown,
      loansVerifiedOnChain,
      verificationRate,
    };

    // Build composite metrics if available (multi-borrower pool with >= 2 loans)
    let compositeMetrics: CompositeMetrics | null = null;
    const isMultiBorrower = pool.borrowerType === BorrowerType.MULTI_BORROWER;
    const hasCompositeData = pool.compositeRiskScore !== null && pool.compositeRiskTier !== null;

    if (isMultiBorrower && hasCompositeData && loanDataPoints.length >= 2) {
      // Calculate component scores from cached weighted values
      const dscrScore = pool.weightedAvgDscr
        ? Math.min(100, Math.max(0, (pool.weightedAvgDscr - 0.5) * 66.67))
        : 50;
      const rateScore = pool.weightedAvgRate
        ? Math.min(100, Math.max(0, 100 - ((pool.weightedAvgRate / 100 - 9) * 16.67)))
        : 50;
      const lendScoreScore = pool.weightedAvgLendScore ?? 50;
      const divScore = pool.diversificationScore ?? 0;

      compositeMetrics = {
        compositeRiskScore: pool.compositeRiskScore!,
        riskTier: pool.compositeRiskTier as RiskTier,
        riskTierBadgeColor: getRiskTierBadgeColor(pool.compositeRiskTier as RiskTier),
        weightedAvgDscr: pool.weightedAvgDscr ?? 0,
        weightedAvgRate: pool.weightedAvgRate ?? 0,
        weightedAvgRateFormatted: `${((pool.weightedAvgRate ?? 0) / 100).toFixed(2)}%`,
        weightedAvgLendScore: pool.weightedAvgLendScore,
        diversificationScore: pool.diversificationScore ?? 0,
        hhiIndex: pool.hhiIndex ?? 1,
        borrowerConcentration: getConcentrationLevel(pool.hhiIndex ?? 1),
        componentScores: {
          dscr: { weight: 0.4, score: Math.round(dscrScore * 100) / 100, contribution: Math.round(dscrScore * 0.4 * 100) / 100 },
          lendScore: { weight: 0.25, score: Math.round(lendScoreScore * 100) / 100, contribution: Math.round(lendScoreScore * 0.25 * 100) / 100 },
          diversification: { weight: 0.2, score: Math.round(divScore * 100) / 100, contribution: Math.round(divScore * 0.2 * 100) / 100 },
          rate: { weight: 0.15, score: Math.round(rateScore * 100) / 100, contribution: Math.round(rateScore * 0.15 * 100) / 100 },
        },
        calculatedAt: pool.compositeCalculatedAt?.toISOString() ?? new Date().toISOString(),
      };
    }

    const responseData = {
      pool: {
        id: pool.id,
        name: pool.name,
        status: pool.status,
        borrowerType: pool.borrowerType,
      },
      // Existing simple averages (backward compatible)
      simpleMetrics: riskMetrics,
      // Weighted composite metrics (null for single-borrower or <2 loans)
      compositeMetrics,
      // Distribution data
      distributions: {
        dscr: dscrDistribution,
        lendScore: lendScoreDistribution,
        industry: industryBreakdown,
      },
      dataSourceNote: 'DSCR and interest rates sourced from Cartesi verifiable computation. LendScore sourced from Plaid. Composite score uses CMBS-style principal-weighted averaging.',
    };

    // Cache the response
    riskMetricsCache.set(slug, { data: responseData, timestamp: Date.now() });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('[Risk Metrics] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch risk metrics' },
      { status: 500 }
    );
  }
}
