import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hashPoolId } from '@/lib/contracts/stakingPool';

/**
 * GET /api/pools/[id]/user-stake
 *
 * Returns contract info for reading user stake data from the blockchain.
 *
 * NOTE: Actual stake data (amount, shares, pending unstake, etc.) should be
 * read directly from the StakingPool contract using the useUserStake hook.
 * This endpoint only provides the necessary contract parameters.
 *
 * For historical transactions, use GET /api/pools/history
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: poolId } = await params;

    // Fetch pool metadata only
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('id, name, slug, contractPoolId, annualizedReturn')
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
        annualizedReturn: pool.annualizedReturn,
      },
      contract: {
        hashedPoolId,
        stakingPoolAddress: process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS,
      },
      // Instructions for frontend
      _note: 'Use useUserStake(poolId) hook to read stake data from chain',
    });
  } catch (error) {
    console.error('User stake API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
