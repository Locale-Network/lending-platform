import { NextRequest, NextResponse } from 'next/server';
import { Contract, JsonRpcProvider, EventLog } from 'ethers';
import prisma from '@prisma/index';
import { stakingPoolAbi } from '@/lib/contracts/stakingPool';
import { isValidEthereumAddress } from '@/lib/validation';
import { USDC_DECIMALS, DEFAULT_BLOCK_LOOKBACK } from '@/lib/constants/business';

const TOKEN_DECIMALS = USDC_DECIMALS;

/**
 * Get user's staking transactions from blockchain events
 * @route GET /api/stake-transactions?address=0x...
 *
 * Queries Staked/Unstaked/UnstakeRequested events filtered by user address,
 * then resolves pool names from the database via contractPoolId.
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
        transactions: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
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
    const [stakedEvents, unstakeRequestedEvents, unstakedEvents] = await Promise.all([
      contract.queryFilter(contract.filters.Staked(null, userAddress), fromBlock, currentBlock),
      contract.queryFilter(contract.filters.UnstakeRequested(null, userAddress), fromBlock, currentBlock),
      contract.queryFilter(contract.filters.Unstaked(null, userAddress), fromBlock, currentBlock),
    ]);

    // Collect unique poolIds to resolve names
    const poolIdSet = new Set<string>();
    for (const e of [...stakedEvents, ...unstakeRequestedEvents, ...unstakedEvents]) {
      if ('args' in e) poolIdSet.add((e as EventLog).args[0]);
    }

    // Resolve pool names from DB
    const poolMap = new Map<string, { name: string; slug: string }>();
    if (poolIdSet.size > 0) {
      const pools = await prisma.loanPool.findMany({
        where: { contractPoolId: { in: Array.from(poolIdSet) } },
        select: { contractPoolId: true, name: true, slug: true },
      });
      for (const p of pools) {
        if (p.contractPoolId) {
          poolMap.set(p.contractPoolId, { name: p.name, slug: p.slug });
        }
      }
    }

    // Get block timestamps
    const blockNumbers = new Set<number>();
    for (const e of [...stakedEvents, ...unstakeRequestedEvents, ...unstakedEvents]) {
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

    const formatAmount = (raw: bigint): number =>
      Number(raw) / Math.pow(10, TOKEN_DECIMALS);

    // Only show events from pools that exist in the DB (filters out old test pools)
    const isKnownPool = (e: EventLog) => poolMap.has(e.args[0]);

    // Transform events
    const stakes = stakedEvents
      .filter((e): e is EventLog => 'args' in e)
      .filter(isKnownPool)
      .map((e) => {
        const pool = poolMap.get(e.args[0])!;
        return {
          id: `${e.transactionHash}-stake-${e.index}`,
          type: 'stake',
          status: 'completed',
          amount: formatAmount(e.args[2]),
          transaction_hash: e.transactionHash,
          block_number: e.blockNumber,
          created_at: blockTimestamps.get(e.blockNumber) || new Date().toISOString(),
          investor_address: e.args[1],
          pool: { name: pool.name, slug: pool.slug },
        };
      });

    const unstakeRequests = unstakeRequestedEvents
      .filter((e): e is EventLog => 'args' in e)
      .filter(isKnownPool)
      .map((e) => {
        const pool = poolMap.get(e.args[0])!;
        return {
          id: `${e.transactionHash}-unstake_request-${e.index}`,
          type: 'unstake_request',
          status: 'completed',
          amount: formatAmount(e.args[2]),
          transaction_hash: e.transactionHash,
          block_number: e.blockNumber,
          created_at: blockTimestamps.get(e.blockNumber) || new Date().toISOString(),
          investor_address: e.args[1],
          pool: { name: pool.name, slug: pool.slug },
        };
      });

    const unstakes = unstakedEvents
      .filter((e): e is EventLog => 'args' in e)
      .filter(isKnownPool)
      .map((e) => {
        const pool = poolMap.get(e.args[0])!;
        return {
          id: `${e.transactionHash}-unstake-${e.index}`,
          type: 'unstake',
          status: 'completed',
          amount: formatAmount(e.args[2]),
          transaction_hash: e.transactionHash,
          block_number: e.blockNumber,
          created_at: blockTimestamps.get(e.blockNumber) || new Date().toISOString(),
          investor_address: e.args[1],
          pool: { name: pool.name, slug: pool.slug },
        };
      });

    const transactions = [...stakes, ...unstakeRequests, ...unstakes]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({
      transactions,
      pagination: {
        page: 1,
        limit: transactions.length,
        total: transactions.length,
        totalPages: 1,
        hasMore: false,
      },
      source: 'blockchain',
    });
  } catch (error) {
    console.error('Stake transactions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
