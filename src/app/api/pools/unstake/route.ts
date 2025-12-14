import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hashPoolId } from '@/lib/contracts/stakingPool';

/**
 * GET /api/pools/unstake
 *
 * Returns pool metadata and contract info needed for unstaking.
 * All actual unstake state is read directly from the blockchain via wagmi hooks.
 *
 * This endpoint provides:
 * - Pool metadata stored off-chain
 * - Hashed pool ID for contract interaction
 * - Contract address
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');

    if (!poolId) {
      return NextResponse.json({ error: 'Missing poolId parameter' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch pool metadata (off-chain data only)
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('id, name, slug, contractPoolId')
      .eq('id', poolId)
      .single();

    if (poolError || !pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    // Get the hashed pool ID for contract interaction
    const hashedPoolId = pool.contractPoolId || hashPoolId(poolId);

    return NextResponse.json({
      pool: {
        id: pool.id,
        name: pool.name,
        slug: pool.slug,
      },
      contract: {
        hashedPoolId,
        stakingPoolAddress: process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS,
      },
    });
  } catch (error) {
    console.error('Get unstake info error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * NOTE: Unstaking is handled entirely on-chain.
 *
 * The unstake flow uses wagmi hooks:
 *
 * 1. useRequestUnstake() - Calls requestUnstake() on contract
 *    - Starts the cooldown period
 *    - Locks the user's stake amount for withdrawal
 *
 * 2. useCompleteUnstake() - Calls completeUnstake() on contract
 *    - Only works after cooldown period ends
 *    - Transfers tokens back to user
 *
 * 3. useCancelUnstake() - Calls cancelUnstake() on contract
 *    - Cancels pending unstake request
 *    - Re-activates the stake
 *
 * All state (pendingUnstake, canWithdrawAt, cooldownPeriod) is read
 * directly from the blockchain via useUserStake() and useCooldownPeriod().
 *
 * Transaction history is synced via the event indexer service.
 */
