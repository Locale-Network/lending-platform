import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { poolId, amount, userAddress } = body;

    if (!poolId || !amount || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: poolId, amount, userAddress' },
        { status: 400 }
      );
    }

    // Validate amount
    if (amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    // Fetch pool to validate it exists
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('id, status, availableLiquidity')
      .eq('id', poolId)
      .single();

    if (poolError || !pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    // Fetch user's stake
    const { data: existingStake, error: stakeError } = await supabase
      .from('user_stakes')
      .select('*')
      .eq('userId', user.id)
      .eq('poolId', poolId)
      .single();

    if (stakeError || !existingStake) {
      return NextResponse.json({ error: 'No active stake found' }, { status: 404 });
    }

    // Validate unstake amount
    if (amount > existingStake.amount) {
      return NextResponse.json(
        { error: 'Unstake amount exceeds staked amount' },
        { status: 400 }
      );
    }

    // TODO: In production, interact with smart contract here to actually unstake funds
    // For now, we'll update the stake in the database

    // Calculate shares to remove (proportional to amount)
    const sharesToRemove = (existingStake.shares / existingStake.amount) * amount;

    if (amount === existingStake.amount) {
      // Full unstake - update status to UNSTAKING
      const { error: updateError } = await supabase
        .from('user_stakes')
        .update({
          status: 'UNSTAKING',
          updatedAt: new Date().toISOString(),
        })
        .eq('id', existingStake.id);

      if (updateError) {
        console.error('Error updating stake:', updateError);
        return NextResponse.json({ error: 'Failed to unstake' }, { status: 500 });
      }
    } else {
      // Partial unstake - reduce amount and shares
      const { error: updateError } = await supabase
        .from('user_stakes')
        .update({
          amount: existingStake.amount - amount,
          shares: existingStake.shares - sharesToRemove,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', existingStake.id);

      if (updateError) {
        console.error('Error updating stake:', updateError);
        return NextResponse.json({ error: 'Failed to unstake' }, { status: 500 });
      }
    }

    // Update pool statistics
    const { error: poolUpdateError } = await supabase.rpc('decrement_pool_stats', {
      p_pool_id: poolId,
      p_amount: amount,
    });

    if (poolUpdateError) {
      console.error('Error updating pool stats:', poolUpdateError);
      // Don't fail the request, just log the error
    }

    // Record transaction
    const { error: txError } = await supabase.from('transactions').insert({
      userId: user.id,
      poolId,
      type: 'UNSTAKE',
      amount,
      status: 'COMPLETED',
      transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`, // Mock hash
    });

    if (txError) {
      console.error('Error recording transaction:', txError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`, // Mock hash - replace with actual
      message: 'Unstake initiated. Funds will be available after 7-day cooldown period.',
      cooldownEnds: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Unstake API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
