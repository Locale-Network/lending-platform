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

    // Fetch pool to validate it exists and get minimum stake
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .select('id, minimumStake, status, availableLiquidity')
      .eq('id', poolId)
      .single();

    if (poolError || !pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    // Validate pool is active
    if (pool.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Pool is not active' }, { status: 400 });
    }

    // Validate minimum stake
    if (amount < pool.minimumStake) {
      return NextResponse.json(
        { error: `Minimum stake is $${pool.minimumStake}` },
        { status: 400 }
      );
    }

    // TODO: In production, interact with smart contract here to actually stake funds
    // For now, we'll record the stake in the database

    // Calculate shares (simplified - in production this should come from smart contract)
    const shares = amount * 0.97; // 3% fee for example

    // Check if user already has a stake in this pool
    const { data: existingStake } = await supabase
      .from('user_stakes')
      .select('*')
      .eq('userId', user.id)
      .eq('poolId', poolId)
      .single();

    if (existingStake) {
      // Update existing stake
      const { error: updateError } = await supabase
        .from('user_stakes')
        .update({
          amount: existingStake.amount + amount,
          shares: existingStake.shares + shares,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', existingStake.id);

      if (updateError) {
        console.error('Error updating stake:', updateError);
        return NextResponse.json({ error: 'Failed to update stake' }, { status: 500 });
      }
    } else {
      // Create new stake
      const { error: insertError } = await supabase.from('user_stakes').insert({
        userId: user.id,
        poolId,
        amount,
        shares,
        walletAddress: userAddress,
      });

      if (insertError) {
        console.error('Error creating stake:', insertError);
        return NextResponse.json({ error: 'Failed to create stake' }, { status: 500 });
      }
    }

    // Update pool statistics
    const { error: poolUpdateError } = await supabase.rpc('increment_pool_stats', {
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
      type: 'STAKE',
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
      message: 'Stake successful',
    });
  } catch (error) {
    console.error('Stake API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
