import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';
import { logger } from '@/lib/logger';
import { checkRateLimit, rateLimits, rateLimitHeaders } from '@/lib/rate-limit';
import { Contract, JsonRpcProvider, EventLog } from 'ethers';
import { stakingPoolAbi } from '@/lib/contracts/stakingPool';
import { USDC_DECIMALS, DEFAULT_BLOCK_LOOKBACK } from '@/lib/constants/business';

const log = logger.child({ module: 'admin-dashboard' });
const TOKEN_DECIMALS = USDC_DECIMALS;

// GET /api/admin/dashboard - Get comprehensive admin dashboard stats
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (session.user.role is already populated by getSession)
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // SECURITY: Rate limiting on admin dashboard (7 parallel DB queries)
    const rateLimitResult = await checkRateLimit(
      `admin-dashboard:${session.address}`,
      rateLimits.api // 100 requests per minute
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    // Read on-chain staking data in parallel with DB queries
    const stakingPoolAddress = process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS;
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;

    // Function to get on-chain staking data
    async function getOnChainStakingData() {
      if (!stakingPoolAddress || !rpcUrl) {
        return { totalTVL: 0, uniqueInvestors: 0, stakedByContractPoolId: new Map<string, number>(), investorsByContractPoolId: new Map<string, number>() };
      }

      const provider = new JsonRpcProvider(rpcUrl);
      const contract = new Contract(stakingPoolAddress, stakingPoolAbi, provider);
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - DEFAULT_BLOCK_LOOKBACK);

      const [stakedEvents, unstakedEvents] = await Promise.all([
        contract.queryFilter(contract.filters.Staked(), fromBlock, currentBlock),
        contract.queryFilter(contract.filters.Unstaked(), fromBlock, currentBlock),
      ]);

      const formatAmount = (raw: bigint): number =>
        Number(raw) / Math.pow(10, TOKEN_DECIMALS);

      // Track per (user, poolId) balances
      const userPoolBalances = new Map<string, Map<string, number>>();

      for (const e of stakedEvents) {
        if (!('args' in e)) continue;
        const ev = e as EventLog;
        const poolId = ev.args[0] as string;
        const user = (ev.args[1] as string).toLowerCase();
        const amount = formatAmount(ev.args[2]);

        if (!userPoolBalances.has(user)) userPoolBalances.set(user, new Map());
        const poolMap = userPoolBalances.get(user)!;
        poolMap.set(poolId, (poolMap.get(poolId) || 0) + amount);
      }

      for (const e of unstakedEvents) {
        if (!('args' in e)) continue;
        const ev = e as EventLog;
        const poolId = ev.args[0] as string;
        const user = (ev.args[1] as string).toLowerCase();
        const amount = formatAmount(ev.args[2]);

        if (!userPoolBalances.has(user)) userPoolBalances.set(user, new Map());
        const poolMap = userPoolBalances.get(user)!;
        poolMap.set(poolId, (poolMap.get(poolId) || 0) - amount);
      }

      // Aggregate: TVL, unique investors, per-pool staked, per-pool investors
      let totalTVL = 0;
      const activeInvestors = new Set<string>();
      const stakedByContractPoolId = new Map<string, number>();
      const investorsByContractPoolId = new Map<string, number>();

      for (const [user, poolMap] of userPoolBalances) {
        for (const [poolId, net] of poolMap) {
          if (net <= 0) continue;
          totalTVL += net;
          activeInvestors.add(user);
          stakedByContractPoolId.set(poolId, (stakedByContractPoolId.get(poolId) || 0) + net);
          investorsByContractPoolId.set(poolId, (investorsByContractPoolId.get(poolId) || 0) + 1);
        }
      }

      return {
        totalTVL: Math.round(totalTVL * 100) / 100,
        uniqueInvestors: activeInvestors.size,
        stakedByContractPoolId,
        investorsByContractPoolId,
      };
    }

    // Run all queries in parallel: on-chain staking + DB queries
    const [
      onChainData,
      poolStats,
      poolsForFeeCalc,
      approvedLoansCount,
      totalLoanValue,
      recentLoansData,
      activePoolsData,
    ] = await Promise.all([
      getOnChainStakingData(),

      // Pool stats using aggregation
      prisma.loanPool.groupBy({
        by: ['status'],
        _count: { id: true },
        _avg: { annualizedReturn: true },
      }),

      // Get pools with their individual fee rates and contractPoolId for mapping
      prisma.loanPool.findMany({
        select: {
          id: true,
          managementFeeRate: true,
          contractPoolId: true,
        },
      }),

      // Total loans count (all non-draft applications)
      prisma.loanApplication.count({
        where: { status: { notIn: ['DRAFT'] } },
      }),

      // Total loan value from pool loans
      prisma.poolLoan.aggregate({
        _sum: { principal: true },
      }),

      // Recent loan applications - limited and selective
      prisma.loanApplication.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          accountAddress: true,
          amount: true,
          requestedAmount: true,
          status: true,
          businessLegalName: true,
          createdAt: true,
        },
      }),

      // Active pools - limited and selective
      prisma.loanPool.findMany({
        where: { status: 'ACTIVE' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          annualizedReturn: true,
          baseInterestRate: true,
          riskPremiumMin: true,
          riskPremiumMax: true,
          contractPoolId: true,
        },
      }),
    ]);

    // Build mapping: contractPoolId → DB pool ID
    const contractToDbId = new Map<string, string>();
    for (const p of poolsForFeeCalc) {
      if (p.contractPoolId) contractToDbId.set(p.contractPoolId, p.id);
    }

    // Map on-chain staked amounts to DB pool IDs
    const stakedByPool = new Map<string, number>();
    for (const [contractPoolId, amount] of onChainData.stakedByContractPoolId) {
      const dbId = contractToDbId.get(contractPoolId);
      if (dbId) stakedByPool.set(dbId, amount);
    }

    const investorCountByPool = new Map<string, number>();
    for (const [contractPoolId, count] of onChainData.investorsByContractPoolId) {
      const dbId = contractToDbId.get(contractPoolId);
      if (dbId) investorCountByPool.set(dbId, count);
    }

    // Calculate total management fees using on-chain staked amounts
    const totalMgmtFees = poolsForFeeCalc.reduce((sum, pool) => {
      const staked = stakedByPool.get(pool.id) || 0;
      const feeRate = pool.managementFeeRate || 0;
      return sum + (staked * feeRate / 100);
    }, 0);

    // Process pool stats from groupBy result
    const statusCounts = poolStats.reduce(
      (acc, stat) => {
        acc[stat.status] = stat._count.id;
        return acc;
      },
      { ACTIVE: 0, DRAFT: 0, PAUSED: 0, CLOSED: 0 } as Record<string, number>
    );

    const totalPools = poolStats.reduce((sum, stat) => sum + stat._count.id, 0);

    // Calculate average APY from active pools
    const activePoolStat = poolStats.find(s => s.status === 'ACTIVE');
    const averageAPY = activePoolStat?._avg?.annualizedReturn || 0;

    // Transform recent loans
    const recentLoans = recentLoansData.map(loan => ({
      id: loan.id,
      borrower: loan.accountAddress.slice(0, 6) + '...' + loan.accountAddress.slice(-4),
      amount: loan.amount || loan.requestedAmount || 0,
      status: loan.status.toLowerCase(),
      businessName: loan.businessLegalName,
      date: getRelativeTime(loan.createdAt),
      createdAt: loan.createdAt,
    }));

    // Transform active pools with on-chain TVL data
    const activePools = activePoolsData.map(pool => ({
      id: pool.id,
      name: pool.name,
      slug: pool.slug,
      tvl: stakedByPool.get(pool.id) || 0,
      investors: investorCountByPool.get(pool.id) || 0,
      apy: pool.annualizedReturn || 0,
    }));

    return NextResponse.json({
      stats: {
        totalValueLocked: onChainData.totalTVL,
        tvlChange: 0, // Would need historical data to calculate
        totalLoans: approvedLoansCount,
        loansChange: 0,
        activeInvestors: onChainData.uniqueInvestors,
        investorsChange: 0,
        platformRevenue: Math.round(totalMgmtFees),
        revenueChange: 0,
      },
      poolStats: {
        totalPools,
        activePools: statusCounts.ACTIVE,
        draftPools: statusCounts.DRAFT,
        pausedPools: statusCounts.PAUSED,
        closedPools: statusCounts.CLOSED,
        averageAPY,
        totalLoanValue: totalLoanValue._sum.principal || 0,
        totalLoansIssued: approvedLoansCount,
      },
      recentLoans,
      activePools,
    });
  } catch (error) {
    log.error({ err: error }, 'Error fetching admin dashboard');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}
