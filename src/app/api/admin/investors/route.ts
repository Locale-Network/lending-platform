import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';
import { logger } from '@/lib/logger';
import { checkRateLimit, getClientIp, rateLimits, rateLimitHeaders } from '@/lib/rate-limit';
import { Contract, JsonRpcProvider, EventLog } from 'ethers';
import { stakingPoolAbi } from '@/lib/contracts/stakingPool';
import { USDC_DECIMALS, DEFAULT_BLOCK_LOOKBACK, getInvestorTier } from '@/lib/constants/business';

const log = logger.child({ module: 'admin-investors' });
const TOKEN_DECIMALS = USDC_DECIMALS;

// GET /api/admin/investors - Get all investors with their stakes from on-chain data
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

    // SECURITY: Rate limiting on admin data access
    const clientIp = await getClientIp();
    const rateLimitResult = await checkRateLimit(
      `admin-investors:${session.address}`,
      rateLimits.api // 100 requests per minute
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    // SECURITY: Parse and validate pagination parameters - parseInt can return NaN
    const searchParams = request.nextUrl.searchParams;
    const pageParam = parseInt(searchParams.get('page') || '1', 10);
    const limitParam = parseInt(searchParams.get('limit') || '20', 10);
    const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam);
    const limit = Math.min(100, Math.max(1, isNaN(limitParam) ? 20 : limitParam));
    const skip = (page - 1) * limit;

    const stakingPoolAddress = process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS;
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;

    if (!stakingPoolAddress || !rpcUrl) {
      return NextResponse.json({
        investors: [],
        pagination: { page, limit, total: 0, totalPages: 0, hasMore: false },
        summary: { totalInvestors: 0, totalInvested: 0, totalReturns: 0, avgInvestment: 0, verifiedCount: 0 },
        source: 'blockchain',
        message: 'Blockchain configuration not available',
      });
    }

    const provider = new JsonRpcProvider(rpcUrl);
    const contract = new Contract(stakingPoolAddress, stakingPoolAbi, provider);

    // Query events from a large block range to capture all history
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - DEFAULT_BLOCK_LOOKBACK);

    const [stakedEvents, unstakedEvents] = await Promise.all([
      contract.queryFilter(contract.filters.Staked(), fromBlock, currentBlock),
      contract.queryFilter(contract.filters.Unstaked(), fromBlock, currentBlock),
    ]);

    const formatAmount = (raw: bigint): number =>
      Number(raw) / Math.pow(10, TOKEN_DECIMALS);

    // Group by (user, poolId) → net balances
    // userPoolBalances: Map<userAddr, Map<poolId, { staked, unstaked, firstStakeBlock }>>
    const userPoolBalances = new Map<string, Map<string, { staked: number; unstaked: number; firstStakeBlock: number }>>();

    for (const e of stakedEvents) {
      if (!('args' in e)) continue;
      const ev = e as EventLog;
      const poolId = ev.args[0] as string;
      const user = (ev.args[1] as string).toLowerCase();
      const amount = formatAmount(ev.args[2]);

      if (!userPoolBalances.has(user)) userPoolBalances.set(user, new Map());
      const poolMap = userPoolBalances.get(user)!;
      const existing = poolMap.get(poolId) || { staked: 0, unstaked: 0, firstStakeBlock: ev.blockNumber };
      existing.staked += amount;
      if (ev.blockNumber < existing.firstStakeBlock) existing.firstStakeBlock = ev.blockNumber;
      poolMap.set(poolId, existing);
    }

    for (const e of unstakedEvents) {
      if (!('args' in e)) continue;
      const ev = e as EventLog;
      const poolId = ev.args[0] as string;
      const user = (ev.args[1] as string).toLowerCase();
      const amount = formatAmount(ev.args[2]);

      if (!userPoolBalances.has(user)) userPoolBalances.set(user, new Map());
      const poolMap = userPoolBalances.get(user)!;
      const existing = poolMap.get(poolId) || { staked: 0, unstaked: 0, firstStakeBlock: ev.blockNumber };
      existing.unstaked += amount;
      poolMap.set(poolId, existing);
    }

    // Get all unique pool IDs and match with DB
    const allPoolIds = new Set<string>();
    for (const [, poolMap] of userPoolBalances) {
      for (const poolId of poolMap.keys()) allPoolIds.add(poolId);
    }

    // Get earliest block per investor for joined date
    const earliestBlocks = new Set<number>();
    for (const [, poolMap] of userPoolBalances) {
      let earliest = Infinity;
      for (const [, balance] of poolMap) {
        if (balance.firstStakeBlock < earliest) earliest = balance.firstStakeBlock;
      }
      if (earliest !== Infinity) earliestBlocks.add(earliest);
    }

    // Parallel: fetch pool data from DB + account emails + block timestamps
    const userAddresses = Array.from(userPoolBalances.keys());
    const [dbPools, accounts, ...blockResults] = await Promise.all([
      allPoolIds.size > 0
        ? prisma.loanPool.findMany({
            where: { contractPoolId: { in: Array.from(allPoolIds) } },
            select: { contractPoolId: true, id: true, name: true, annualizedReturn: true },
          })
        : Promise.resolve([]),
      userAddresses.length > 0
        ? prisma.account.findMany({
            where: { address: { in: userAddresses, mode: 'insensitive' } },
            select: { address: true, email: true },
          })
        : Promise.resolve([]),
      ...Array.from(earliestBlocks).map(async (bn) => {
        const block = await provider.getBlock(bn);
        return { blockNumber: bn, timestamp: block ? block.timestamp : 0 };
      }),
    ]);

    const poolDataMap = new Map<string, (typeof dbPools)[0]>();
    for (const p of dbPools) {
      if (p.contractPoolId) poolDataMap.set(p.contractPoolId, p);
    }

    const emailMap = new Map<string, string | null>();
    for (const a of accounts) {
      emailMap.set(a.address.toLowerCase(), a.email);
    }

    const blockTimestampMap = new Map<number, number>();
    for (const br of blockResults) {
      blockTimestampMap.set(br.blockNumber, br.timestamp);
    }

    // Build investor list
    const investors = [];
    for (const [user, poolMap] of userPoolBalances) {
      let totalInvested = 0;
      let activeInvestments = 0;
      let earliestBlock = Infinity;
      const apys: number[] = [];

      for (const [poolId, balance] of poolMap) {
        const net = balance.staked - balance.unstaked;
        if (net <= 0) continue;

        totalInvested += net;
        activeInvestments++;

        const poolData = poolDataMap.get(poolId);
        if (poolData?.annualizedReturn) apys.push(poolData.annualizedReturn);
        if (balance.firstStakeBlock < earliestBlock) earliestBlock = balance.firstStakeBlock;
      }

      if (totalInvested <= 0) continue; // Skip fully unstaked investors

      const avgAPY = apys.length > 0
        ? apys.reduce((s, v) => s + v, 0) / apys.length
        : 0;

      // Estimate returns from APY and time staked
      const stakeTimestamp = blockTimestampMap.get(earliestBlock) || 0;
      const daysSinceStake = stakeTimestamp > 0
        ? Math.floor((Date.now() / 1000 - stakeTimestamp) / 86400)
        : 0;
      const estimatedReturns = avgAPY > 0
        ? totalInvested * (avgAPY / 100) * (daysSinceStake / 365)
        : 0;

      const tier = getInvestorTier(totalInvested);

      const email = emailMap.get(user);
      const joinedDate = stakeTimestamp > 0
        ? new Date(stakeTimestamp * 1000).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      investors.push({
        id: user,
        address: user,
        shortAddress: `${user.slice(0, 6)}...${user.slice(-4)}`,
        totalInvested: Math.round(totalInvested * 100) / 100,
        activeInvestments,
        totalReturns: Math.round(estimatedReturns * 100) / 100,
        avgAPY: Math.round(avgAPY * 10) / 10,
        joinedDate,
        tier,
        verified: !!email,
        email: email || null,
      });
    }

    // Sort by total invested (descending)
    investors.sort((a, b) => b.totalInvested - a.totalInvested);

    // Calculate summary stats
    const totalInvestors = investors.length;
    const totalInvested = investors.reduce((sum, inv) => sum + inv.totalInvested, 0);
    const totalReturns = investors.reduce((sum, inv) => sum + inv.totalReturns, 0);
    const avgInvestment = totalInvestors > 0 ? totalInvested / totalInvestors : 0;
    const verifiedCount = investors.filter(i => i.verified).length;

    // Apply pagination
    const paginatedInvestors = investors.slice(skip, skip + limit);
    const totalPages = Math.ceil(totalInvestors / limit);

    return NextResponse.json({
      investors: paginatedInvestors,
      pagination: {
        page,
        limit,
        total: totalInvestors,
        totalPages,
        hasMore: page < totalPages,
      },
      summary: {
        totalInvestors,
        totalInvested: Math.round(totalInvested * 100) / 100,
        totalReturns: Math.round(totalReturns * 100) / 100,
        avgInvestment: Math.round(avgInvestment * 100) / 100,
        verifiedCount,
      },
      source: 'blockchain',
    });
  } catch (error) {
    log.error({ err: error }, 'Error fetching investors');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
