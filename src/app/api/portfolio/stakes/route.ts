import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all user stakes with pool information
    const { data: stakes, error } = await supabase
      .from('user_stakes')
      .select(`
        id,
        amount,
        shares,
        createdAt,
        updatedAt,
        pool:pools(
          id,
          name,
          slug,
          annualizedReturn,
          poolType,
          status
        )
      `)
      .eq('userId', user.id)
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('Error fetching stakes:', error);
      return NextResponse.json({ error: 'Failed to fetch stakes' }, { status: 500 });
    }

    // Calculate rewards for each stake
    const stakesWithRewards = stakes.map(stake => {
      const daysSinceStake = Math.floor(
        (new Date().getTime() - new Date(stake.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const pool = Array.isArray(stake.pool) ? stake.pool[0] : stake.pool;
      const apy = pool?.annualizedReturn || 12;
      const dailyRate = apy / 365 / 100;
      const rewards = stake.amount * dailyRate * daysSinceStake;

      return {
        ...stake,
        rewards: Math.round(rewards * 100) / 100,
        currentValue: stake.amount + rewards,
      };
    });

    // Calculate portfolio totals
    const totalInvested = stakesWithRewards.reduce((sum, stake) => sum + stake.amount, 0);
    const totalRewards = stakesWithRewards.reduce((sum, stake) => sum + stake.rewards, 0);
    const totalValue = totalInvested + totalRewards;
    const avgReturn =
      stakesWithRewards.length > 0
        ? stakesWithRewards.reduce((sum, stake) => {
            const pool = Array.isArray(stake.pool) ? stake.pool[0] : stake.pool;
            return sum + (pool?.annualizedReturn || 0);
          }, 0) / stakesWithRewards.length
        : 0;

    return NextResponse.json({
      stakes: stakesWithRewards,
      summary: {
        totalInvested,
        totalRewards,
        totalValue,
        activeInvestments: stakesWithRewards.length,
        avgReturn: Math.round(avgReturn * 10) / 10,
      },
    });
  } catch (error) {
    console.error('Portfolio API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
