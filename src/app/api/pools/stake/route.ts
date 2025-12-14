import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hashPoolId } from '@/lib/contracts/stakingPool';

/**
 * GET /api/pools/stake
 *
 * Returns pool metadata and contract info needed for staking.
 * All actual stake data is read directly from the blockchain via wagmi hooks.
 *
 * This endpoint provides:
 * - Pool metadata (name, description) stored off-chain
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
      .select('id, name, description, slug, imageUrl, contractPoolId')
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
        description: pool.description,
        slug: pool.slug,
        imageUrl: pool.imageUrl,
      },
      contract: {
        hashedPoolId,
        stakingPoolAddress: process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS,
      },
    });
  } catch (error) {
    console.error('Get stake info error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * NOTE: Staking is handled entirely on-chain.
 *
 * The frontend uses wagmi hooks (useStake, useStakeWithApproval) to:
 * 1. Check token allowance
 * 2. Approve token spending if needed
 * 3. Call stake() on the StakingPool contract
 *
 * All stake balances, shares, and pool totals are read directly from
 * the blockchain - no database storage needed.
 *
 * Transaction history can be retrieved via:
 * - Contract events (Staked, UnstakeRequested, Unstaked)
 * - Blockchain indexers (The Graph, Alchemy, etc.)
 */
