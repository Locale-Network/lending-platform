import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type'); // Filter by transaction type
    const status = searchParams.get('status'); // Filter by status
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Get user's wallet address
    const { data: accountData } = await supabase
      .from('accounts')
      .select('address')
      .eq('id', user.id)
      .single();

    if (!accountData) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Build query
    let query = supabase
      .from('stake_transactions')
      .select(
        `
        *,
        pool:loan_pools (
          id,
          name,
          slug,
          annualized_return
        )
      `,
        { count: 'exact' }
      )
      .eq('investor_address', accountData.address)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (type) {
      query = query.eq('type', type);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    // Calculate total pages
    const totalPages = count ? Math.ceil(count / limit) : 0;

    return NextResponse.json({
      transactions: transactions || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error('Stake transactions API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
