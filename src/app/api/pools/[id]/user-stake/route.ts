import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: poolId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    // Fetch user's stake for this pool
    const { data: stake, error } = await supabase
      .from('user_stakes')
      .select(`
        *,
        pool:pools(
          name,
          annualizedReturn
        )
      `)
      .eq('userId', user.id)
      .eq('poolId', poolId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is OK
      console.error('Error fetching stake:', error);
      return NextResponse.json({ error: 'Failed to fetch stake' }, { status: 500 });
    }

    if (!stake) {
      return NextResponse.json({
        hasStake: false,
        amount: 0,
        shares: 0,
        rewards: 0,
      });
    }

    // Calculate rewards (simplified - in production this should come from smart contract)
    const daysSinceStake = Math.floor(
      (new Date().getTime() - new Date(stake.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const apy = stake.pool?.annualizedReturn || 12;
    const dailyRate = apy / 365 / 100;
    const rewards = stake.amount * dailyRate * daysSinceStake;

    return NextResponse.json({
      hasStake: true,
      amount: stake.amount,
      shares: stake.shares,
      rewards: Math.round(rewards * 100) / 100, // Round to 2 decimals
      stakedAt: stake.createdAt,
      walletAddress: stake.walletAddress,
    });
  } catch (error) {
    console.error('User stake API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
