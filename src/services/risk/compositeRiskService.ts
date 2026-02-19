/**
 * Composite Risk Scoring Service
 *
 * Calculates portfolio-level risk metrics for multi-borrower lending pools
 * using industry-standard methodologies (CMBS-style weighted averages, HHI).
 *
 * This module handles database interactions and contract calls.
 * Pure calculation functions are in ./calculations.ts
 */

import 'server-only';
import { prisma } from '@/lib/prisma';
import { BorrowerType, LoanApplicationStatus } from '@prisma/client';
import { basisPointsToPercent } from '@/lib/interest-rate';
import { createPublicClient, http, parseAbi, type Chain } from 'viem';
import { arbitrum, arbitrumSepolia } from 'viem/chains';
import { keccak256, toUtf8Bytes } from 'ethers';
import {
  calculateCompositeScore,
  getConcentrationLevel,
  type PoolLoanData,
  type CompositeRiskResult,
} from './calculations';

// Re-export types and calculation functions
export * from './calculations';

// Chain configuration (same as relay service)
const anvil: Chain = {
  id: 31337,
  name: 'Anvil Local',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
  testnet: true,
};

const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID ? parseInt(process.env.NEXT_PUBLIC_CHAIN_ID, 10) : undefined;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const SIMPLE_LOAN_POOL_ADDRESS = (process.env.SIMPLE_LOAN_POOL_ADDRESS ||
  process.env.NEXT_PUBLIC_LOAN_POOL_ADDRESS) as `0x${string}`;

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
  // Use keccak256 hash of the loan ID string (same as other contract interactions)
  const hash = keccak256(toUtf8Bytes(loanId));
  return hash as `0x${string}`;
}

// ============================================
// Data Fetching Helpers
// ============================================

interface PoolLoanWithApp {
  id: string;
  principal: number;
  interestRate: number;
  loanApplicationId: string;
  loanApplication: {
    id: string;
    status: LoanApplicationStatus;
    lendScore: number | null;
    businessPrimaryIndustry: string;
  };
}

/**
 * Create a viem public client for reading from the blockchain
 */
function getPublicClient() {
  const chain = getChain();
  return createPublicClient({
    chain,
    transport: http(RPC_URL),
  });
}

/**
 * Fetch DSCR values from on-chain contract for each loan
 */
async function fetchPoolLoanData(
  loans: PoolLoanWithApp[]
): Promise<PoolLoanData[]> {
  const poolLoanData: PoolLoanData[] = [];

  // Check if we have the contract address configured
  const hasContract = !!SIMPLE_LOAN_POOL_ADDRESS;
  let publicClient: ReturnType<typeof getPublicClient> | null = null;

  if (hasContract) {
    try {
      publicClient = getPublicClient();
    } catch (error) {
      console.warn('[CompositeRisk] Could not create public client, using DB values');
    }
  }

  for (const loan of loans) {
    const loanIdBytes = loanIdToBytes32(loan.loanApplicationId);

    let dscr: number | null = null;
    let verifiedOnChain = false;

    // Try to get DSCR from on-chain
    if (publicClient && SIMPLE_LOAN_POOL_ADDRESS) {
      try {
        const hasVerified = await publicClient.readContract({
          address: SIMPLE_LOAN_POOL_ADDRESS,
          abi: SIMPLE_LOAN_POOL_ABI,
          functionName: 'hasZkFetchVerifiedDscr',
          args: [loanIdBytes],
        });

        if (hasVerified) {
          const zkResult = await publicClient.readContract({
            address: SIMPLE_LOAN_POOL_ADDRESS,
            abi: SIMPLE_LOAN_POOL_ABI,
            functionName: 'getZkFetchDscrResult',
            args: [loanIdBytes],
          });
          // zkResult[0] is dscrValue (scaled by 10000)
          dscr = Number(zkResult[0]) / 10000;
          verifiedOnChain = true;
        }
      } catch (error) {
        console.warn(
          `[CompositeRisk] Failed to fetch on-chain DSCR for loan ${loan.loanApplicationId}:`,
          error
        );
      }
    }

    // Fallback: Try to get DSCR from most recent DSCRCalculationLog
    if (dscr === null) {
      const dscrLog = await prisma.dSCRCalculationLog.findFirst({
        where: {
          loanApplicationId: loan.loanApplicationId,
          status: 'COMPLETED',
        },
        orderBy: { completedAt: 'desc' },
      });

      if (dscrLog?.calculatedRate) {
        dscr = dscrLog.calculatedRate;
      }
    }

    poolLoanData.push({
      loanId: loan.loanApplicationId,
      principal: loan.principal,
      dscr,
      interestRate: loan.interestRate * 100, // Convert to basis points if stored as percentage
      lendScore: loan.loanApplication.lendScore,
      industry: loan.loanApplication.businessPrimaryIndustry,
      verifiedOnChain,
    });
  }

  return poolLoanData;
}

/**
 * Persist composite metrics to the LoanPool model
 */
async function persistCompositeMetrics(
  poolId: string,
  result: CompositeRiskResult
): Promise<void> {
  await prisma.loanPool.update({
    where: { id: poolId },
    data: {
      compositeRiskScore: result.compositeScore,
      compositeRiskTier: result.riskTier,
      weightedAvgDscr: result.weightedDscr,
      weightedAvgRate: result.weightedRate,
      weightedAvgLendScore: result.weightedLendScore,
      diversificationScore: result.diversificationScore,
      hhiIndex: result.hhiIndex,
      compositeCalculatedAt: result.calculatedAt,
    },
  });
}

// ============================================
// Main Calculation Function
// ============================================

/**
 * Calculate composite risk score for a pool
 * Returns null if pool is single-borrower or has < 2 loans
 */
export async function calculateCompositeRisk(
  poolId: string
): Promise<CompositeRiskResult | null> {
  // Fetch pool with loans
  const pool = await prisma.loanPool.findUnique({
    where: { id: poolId },
    include: {
      loans: {
        include: {
          loanApplication: {
            select: {
              id: true,
              status: true,
              lendScore: true,
              businessPrimaryIndustry: true,
            },
          },
        },
      },
    },
  });

  if (!pool) {
    console.error(`[CompositeRisk] Pool not found: ${poolId}`);
    return null;
  }

  // Skip single-borrower pools
  if (pool.borrowerType === BorrowerType.SINGLE_BORROWER) {
    console.log(`[CompositeRisk] Skipping single-borrower pool: ${poolId}`);
    return null;
  }

  // Need at least 2 loans for composite scoring
  if (pool.loans.length < 2) {
    console.log(`[CompositeRisk] Pool has ${pool.loans.length} loans, need >= 2: ${poolId}`);
    return null;
  }

  // Fetch DSCR values from on-chain or fallback
  const poolLoanData = await fetchPoolLoanData(pool.loans);

  // Use the pure calculation function
  const calculationResult = calculateCompositeScore(poolLoanData);
  const calculatedAt = new Date();

  const result: CompositeRiskResult = {
    ...calculationResult,
    weightedRateFormatted: `${basisPointsToPercent(calculationResult.weightedRate).toFixed(2)}%`,
    loanCount: poolLoanData.length,
    calculatedAt,
  };

  // Persist to database
  await persistCompositeMetrics(poolId, result);

  console.log(
    `[CompositeRisk] Calculated for pool ${poolId}: ` +
    `score=${result.compositeScore}, tier=${result.riskTier}, ` +
    `wDSCR=${result.weightedDscr}, HHI=${result.hhiIndex}`
  );

  return result;
}

// ============================================
// Batch & Trigger Functions
// ============================================

/**
 * Recalculate composite risk for all active multi-borrower pools
 * Used by CRON job for periodic refresh
 */
export async function recalculateAllPools(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const pools = await prisma.loanPool.findMany({
    where: {
      status: 'ACTIVE',
      borrowerType: BorrowerType.MULTI_BORROWER,
    },
    select: { id: true, name: true },
  });

  let succeeded = 0;
  let failed = 0;

  for (const pool of pools) {
    try {
      const result = await calculateCompositeRisk(pool.id);
      if (result) {
        succeeded++;
      }
    } catch (error) {
      console.error(`[CompositeRisk] Failed to calculate for pool ${pool.name}:`, error);
      failed++;
    }
  }

  console.log(
    `[CompositeRisk] Batch recalculation complete: ` +
    `${succeeded} succeeded, ${failed} failed, ${pools.length} total`
  );

  return {
    processed: pools.length,
    succeeded,
    failed,
  };
}

/**
 * Trigger composite risk recalculation for a specific loan
 * Called after DSCR notice is processed
 */
export async function triggerPoolRiskRecalculation(
  loanApplicationId: string
): Promise<void> {
  // Find the pool(s) this loan belongs to
  const poolLoans = await prisma.poolLoan.findMany({
    where: { loanApplicationId },
    select: { poolId: true },
  });

  for (const poolLoan of poolLoans) {
    try {
      await calculateCompositeRisk(poolLoan.poolId);
    } catch (error) {
      console.error(
        `[CompositeRisk] Failed to recalculate pool ${poolLoan.poolId} ` +
        `after loan ${loanApplicationId} update:`,
        error
      );
    }
  }
}

/**
 * Get cached composite metrics from database
 * Use this for quick reads without recalculation
 */
export async function getCachedCompositeMetrics(poolId: string): Promise<{
  compositeRiskScore: number | null;
  compositeRiskTier: string | null;
  weightedAvgDscr: number | null;
  weightedAvgRate: number | null;
  weightedAvgLendScore: number | null;
  diversificationScore: number | null;
  hhiIndex: number | null;
  compositeCalculatedAt: Date | null;
  borrowerType: BorrowerType;
} | null> {
  const pool = await prisma.loanPool.findUnique({
    where: { id: poolId },
    select: {
      compositeRiskScore: true,
      compositeRiskTier: true,
      weightedAvgDscr: true,
      weightedAvgRate: true,
      weightedAvgLendScore: true,
      diversificationScore: true,
      hhiIndex: true,
      compositeCalculatedAt: true,
      borrowerType: true,
    },
  });

  return pool;
}
