import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserStakingHistory, getPoolStakingStats } from '@/services/contracts/stakingPoolIndexer';

/**
 * GET /api/pools/history
 *
 * Returns staking transaction history from indexed events.
 *
 * Query parameters:
 * - userAddress: Filter by user wallet address
 * - poolId: Filter by pool ID (hashed bytes32)
 * - type: Filter by event type (STAKED, UNSTAKE_REQUESTED, UNSTAKED)
 * - limit: Maximum number of results (default 50)
 * - offset: Pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');
    const poolId = searchParams.get('poolId');
    const eventType = searchParams.get('type');

    // SECURITY: Validate pagination params - parseInt can return NaN for invalid input
    const limitParam = parseInt(searchParams.get('limit') || '50', 10);
    const offsetParam = parseInt(searchParams.get('offset') || '0', 10);

    // Ensure valid numbers with safe bounds
    const limit = Math.min(Math.max(1, isNaN(limitParam) ? 50 : limitParam), 100);
    const offset = Math.max(0, isNaN(offsetParam) ? 0 : offsetParam);

    const supabase = await createClient();

    // Build query
    let query = supabase
      .from('staking_events')
      .select('*', { count: 'exact' })
      .order('block_number', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userAddress) {
      query = query.eq('user_address', userAddress.toLowerCase());
    }

    if (poolId) {
      query = query.eq('pool_id', poolId);
    }

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching staking history:', error);
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }

    return NextResponse.json({
      events: data || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error('Staking history API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
