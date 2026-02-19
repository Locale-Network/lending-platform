import { NextRequest, NextResponse } from 'next/server';
import { Contract, JsonRpcProvider, EventLog } from 'ethers';
import prisma from '@prisma/index';
import { stakingPoolAbi } from '@/lib/contracts/stakingPool';
import { isValidEthereumAddress } from '@/lib/validation';
import { USDC_DECIMALS, DEFAULT_BLOCK_LOOKBACK } from '@/lib/constants/business';

const TOKEN_DECIMALS = USDC_DECIMALS;

/**
 * Get user's staking portfolio from blockchain events
 * @route GET /api/portfolio/stakes?address=0x...
 *
 * Queries Staked/Unstaked events filtered by user address, groups by poolId,
 * then resolves pool data from the database. Only shows pools that exist in the DB.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userAddress = searchParams.get('address');

    if (!userAddress) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    if (!isValidEthereumAddress(userAddress)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address format' },
        { status: 400 }
      );
    }

    const stakingPoolAddress = process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS;
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;

    if (!stakingPoolAddress || !rpcUrl) {
      return NextResponse.json({
        stakes: [],
        summary: {
          totalInvested: 0,
          totalRewards: 0,
          totalValue: 0,
          activeInvestments: 0,
          avgReturn: 0,
        },
        message: 'Blockchain configuration not available'
      });
    }

    const provider = new JsonRpcProvider(rpcUrl);
    const contract = new Contract(stakingPoolAddress, stakingPoolAbi, provider);

    // Query last ~5M blocks for this user's events
    // Arbitrum produces blocks every ~0.25s, so 5M blocks ≈ ~14 days of history
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - DEFAULT_BLOCK_LOOKBACK);

    // Filter by user address (second indexed topic)
    const [stakedEvents, unstakedEvents] = await Promise.all([
      contract.queryFilter(contract.filters.Staked(null, userAddress), fromBlock, currentBlock),
      contract.queryFilter(contract.filters.Unstaked(null, userAddress), fromBlock, currentBlock),
    ]);

    const formatAmount = (raw: bigint): number =>
      Number(raw) / Math.pow(10, TOKEN_DECIMALS);

    // Group net amounts by poolId
    const poolBalances = new Map<string, { staked: number; unstaked: number; firstStakeTime: string }>();

    // Get block timestamps for first-stake tracking
    const blockNumbers = new Set<number>();
    for (const e of [...stakedEvents, ...unstakedEvents]) {
      blockNumbers.add(e.blockNumber);
    }
    const blockTimestamps = new Map<number, string>();
    await Promise.all(
      Array.from(blockNumbers).map(async (bn) => {
        const block = await provider.getBlock(bn);
        if (block) {
          blockTimestamps.set(bn, new Date(block.timestamp * 1000).toISOString());
        }
      })
    );

    for (const e of stakedEvents) {
      if (!('args' in e)) continue;
      const ev = e as EventLog;
      const poolId = ev.args[0] as string;
      const amount = formatAmount(ev.args[2]);
      const timestamp = blockTimestamps.get(ev.blockNumber) || new Date().toISOString();
      const existing = poolBalances.get(poolId) || { staked: 0, unstaked: 0, firstStakeTime: timestamp };
      existing.staked += amount;
      if (timestamp < existing.firstStakeTime) existing.firstStakeTime = timestamp;
      poolBalances.set(poolId, existing);
    }

    for (const e of unstakedEvents) {
      if (!('args' in e)) continue;
      const ev = e as EventLog;
      const poolId = ev.args[0] as string;
      const amount = formatAmount(ev.args[2]);
      const existing = poolBalances.get(poolId) || { staked: 0, unstaked: 0, firstStakeTime: new Date().toISOString() };
      existing.unstaked += amount;
      poolBalances.set(poolId, existing);
    }

    // Resolve pool data from DB (only include known pools)
    const poolIds = Array.from(poolBalances.keys());
    const dbPools = poolIds.length > 0
      ? await prisma.loanPool.findMany({
          where: { contractPoolId: { in: poolIds } },
          select: {
            contractPoolId: true,
            id: true,
            name: true,
            slug: true,
            annualizedReturn: true,
            poolType: true,
            status: true,
          },
        })
      : [];

    const poolDataMap = new Map<string, typeof dbPools[0]>();
    for (const p of dbPools) {
      if (p.contractPoolId) poolDataMap.set(p.contractPoolId, p);
    }

    // Build stakes array (one per pool, only for DB-known pools)
    const stakes = [];
    for (const [poolId, balance] of poolBalances) {
      const poolData = poolDataMap.get(poolId);
      if (!poolData) continue; // Skip pools not in DB (old test pools)

      const netStaked = balance.staked - balance.unstaked;
      if (netStaked <= 0) continue; // Skip fully unstaked pools

      const poolApy = poolData.annualizedReturn ?? 0;
      const daysSinceStake = Math.floor(
        (new Date().getTime() - new Date(balance.firstStakeTime).getTime()) / (1000 * 60 * 60 * 24)
      );

      let rewards = 0;
      if (poolApy > 0) {
        const dailyRate = poolApy / 365 / 100;
        rewards = netStaked * dailyRate * daysSinceStake;
      }

      stakes.push({
        id: `${poolId}-stake`,
        amount: Math.round(netStaked * 100) / 100,
        shares: Math.round(netStaked * 100) / 100,
        pendingRewards: Math.round(rewards * 100) / 100,
        rewards: Math.round(rewards * 100) / 100,
        currentValue: Math.round((netStaked + rewards) * 100) / 100,
        createdAt: balance.firstStakeTime,
        pool: {
          id: poolData.id,
          name: poolData.name,
          slug: poolData.slug,
          annualizedReturn: poolData.annualizedReturn,
          poolType: poolData.poolType,
          status: poolData.status,
        },
      });
    }

    // Calculate summary
    const totalInvested = stakes.reduce((sum, s) => sum + s.amount, 0);
    const totalRewards = stakes.reduce((sum, s) => sum + s.rewards, 0);
    const avgReturn = stakes.length > 0
      ? stakes.reduce((sum, s) => sum + (s.pool.annualizedReturn ?? 0), 0) / stakes.length
      : null;

    return NextResponse.json({
      stakes,
      summary: {
        totalInvested: Math.round(totalInvested * 100) / 100,
        totalRewards: Math.round(totalRewards * 100) / 100,
        totalValue: Math.round((totalInvested + totalRewards) * 100) / 100,
        activeInvestments: stakes.length,
        avgReturn,
      },
      source: 'blockchain',
    });
  } catch (error) {
    console.error('Portfolio stakes API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
