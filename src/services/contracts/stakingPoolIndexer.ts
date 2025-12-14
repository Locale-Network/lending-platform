import 'server-only';

import { Contract, JsonRpcProvider, Log, EventLog } from 'ethers';
import { createClient } from '@/lib/supabase/server';
import { stakingPoolAbi } from '@/lib/contracts/stakingPool';

/**
 * StakingPool Event Indexer
 *
 * This service syncs on-chain events to the database for:
 * - Transaction history queries
 * - Analytics and reporting
 * - Fast historical data access
 *
 * The blockchain remains the source of truth for current state.
 * This indexer provides queryable historical data.
 */

// Lazy initialization to avoid build-time errors when env vars are not set
let _provider: JsonRpcProvider | null = null;
let _stakingPool: Contract | null = null;

function getProvider(): JsonRpcProvider {
  if (!_provider) {
    if (!process.env.NEXT_PUBLIC_RPC_URL) {
      throw new Error('NEXT_PUBLIC_RPC_URL not configured');
    }
    _provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
  }
  return _provider;
}

function getStakingPool(): Contract {
  if (!_stakingPool) {
    if (!process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS) {
      throw new Error('NEXT_PUBLIC_STAKING_POOL_ADDRESS not configured');
    }
    _stakingPool = new Contract(
      process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS,
      stakingPoolAbi,
      getProvider()
    );
  }
  return _stakingPool;
}

// Event signatures for filtering
const STAKED_EVENT = 'Staked';
const UNSTAKE_REQUESTED_EVENT = 'UnstakeRequested';
const UNSTAKED_EVENT = 'Unstaked';

interface IndexerState {
  lastIndexedBlock: number;
}

/**
 * Get the last indexed block from the database
 */
async function getLastIndexedBlock(): Promise<number> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('indexer_state')
    .select('last_indexed_block')
    .eq('contract', 'StakingPool')
    .single();

  // Default to deployment block or recent block if not found
  return data?.last_indexed_block || 0;
}

/**
 * Update the last indexed block in the database
 */
async function setLastIndexedBlock(blockNumber: number): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from('indexer_state')
    .upsert({
      contract: 'StakingPool',
      last_indexed_block: blockNumber,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'contract',
    });
}

/**
 * Process a Staked event
 */
async function processStakedEvent(event: EventLog): Promise<void> {
  const supabase = await createClient();

  const [poolId, user, amount, shares, fee] = event.args || [];

  await supabase.from('staking_events').insert({
    event_type: 'STAKED',
    pool_id: poolId,
    user_address: user,
    amount: amount.toString(),
    shares: shares.toString(),
    fee: fee.toString(),
    transaction_hash: event.transactionHash,
    block_number: event.blockNumber,
    block_timestamp: null, // Will be filled by block lookup if needed
    created_at: new Date().toISOString(),
  });
}

/**
 * Process an UnstakeRequested event
 */
async function processUnstakeRequestedEvent(event: EventLog): Promise<void> {
  const supabase = await createClient();

  const [poolId, user, amount, unlockTime] = event.args || [];

  await supabase.from('staking_events').insert({
    event_type: 'UNSTAKE_REQUESTED',
    pool_id: poolId,
    user_address: user,
    amount: amount.toString(),
    unlock_time: new Date(Number(unlockTime) * 1000).toISOString(),
    transaction_hash: event.transactionHash,
    block_number: event.blockNumber,
    created_at: new Date().toISOString(),
  });
}

/**
 * Process an Unstaked event
 */
async function processUnstakedEvent(event: EventLog): Promise<void> {
  const supabase = await createClient();

  const [poolId, user, amount] = event.args || [];

  await supabase.from('staking_events').insert({
    event_type: 'UNSTAKED',
    pool_id: poolId,
    user_address: user,
    amount: amount.toString(),
    transaction_hash: event.transactionHash,
    block_number: event.blockNumber,
    created_at: new Date().toISOString(),
  });
}

/**
 * Index events from a range of blocks
 */
export async function indexEventsInRange(
  fromBlock: number,
  toBlock: number
): Promise<number> {
  let eventsProcessed = 0;

  try {
    // Query all staking events in the block range
    const pool = getStakingPool();
    const stakedFilter = pool.filters.Staked();
    const unstakeRequestedFilter = pool.filters.UnstakeRequested();
    const unstakedFilter = pool.filters.Unstaked();

    const [stakedEvents, unstakeRequestedEvents, unstakedEvents] = await Promise.all([
      pool.queryFilter(stakedFilter, fromBlock, toBlock),
      pool.queryFilter(unstakeRequestedFilter, fromBlock, toBlock),
      pool.queryFilter(unstakedFilter, fromBlock, toBlock),
    ]);

    // Process Staked events
    for (const event of stakedEvents) {
      if ('args' in event) {
        await processStakedEvent(event as EventLog);
        eventsProcessed++;
      }
    }

    // Process UnstakeRequested events
    for (const event of unstakeRequestedEvents) {
      if ('args' in event) {
        await processUnstakeRequestedEvent(event as EventLog);
        eventsProcessed++;
      }
    }

    // Process Unstaked events
    for (const event of unstakedEvents) {
      if ('args' in event) {
        await processUnstakedEvent(event as EventLog);
        eventsProcessed++;
      }
    }

    // Update the last indexed block
    await setLastIndexedBlock(toBlock);

    return eventsProcessed;
  } catch (error) {
    console.error('Error indexing events:', error);
    throw error;
  }
}

/**
 * Main indexer function - indexes new events since last run
 */
export async function runIndexer(): Promise<{ blocksProcessed: number; eventsProcessed: number }> {
  const lastIndexedBlock = await getLastIndexedBlock();
  const currentBlock = await getProvider().getBlockNumber();

  if (lastIndexedBlock >= currentBlock) {
    return { blocksProcessed: 0, eventsProcessed: 0 };
  }

  // Process in chunks to avoid RPC limits
  const CHUNK_SIZE = 1000;
  let eventsProcessed = 0;
  let fromBlock = lastIndexedBlock + 1;

  while (fromBlock <= currentBlock) {
    const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, currentBlock);
    const events = await indexEventsInRange(fromBlock, toBlock);
    eventsProcessed += events;
    fromBlock = toBlock + 1;
  }

  return {
    blocksProcessed: currentBlock - lastIndexedBlock,
    eventsProcessed,
  };
}

/**
 * Get staking history for a user
 */
export async function getUserStakingHistory(
  userAddress: string,
  poolId?: string
): Promise<any[]> {
  const supabase = await createClient();

  let query = supabase
    .from('staking_events')
    .select('*')
    .eq('user_address', userAddress.toLowerCase())
    .order('block_number', { ascending: false });

  if (poolId) {
    query = query.eq('pool_id', poolId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching staking history:', error);
    return [];
  }

  return data || [];
}

/**
 * Get pool statistics from indexed events
 */
export async function getPoolStakingStats(poolId: string): Promise<{
  totalStakeEvents: number;
  totalUnstakeEvents: number;
  uniqueStakers: number;
}> {
  const supabase = await createClient();

  const { data: stakeEvents } = await supabase
    .from('staking_events')
    .select('user_address')
    .eq('pool_id', poolId)
    .eq('event_type', 'STAKED');

  const { data: unstakeEvents } = await supabase
    .from('staking_events')
    .select('user_address')
    .eq('pool_id', poolId)
    .eq('event_type', 'UNSTAKED');

  const uniqueStakers = new Set(
    (stakeEvents || []).map((e) => e.user_address.toLowerCase())
  ).size;

  return {
    totalStakeEvents: stakeEvents?.length || 0,
    totalUnstakeEvents: unstakeEvents?.length || 0,
    uniqueStakers,
  };
}
