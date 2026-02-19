import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import { createClient } from '@/lib/supabase/server';

// GET /api/admin/activity - Get recent platform activity (stakes, loans, repayments)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Check if user is admin
    const { data: user } = await supabase
      .from('accounts')
      .select('role')
      .eq('address', session.address)
      .single();

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Get query parameters with validation
    const searchParams = request.nextUrl.searchParams;
    // SECURITY: Validate pagination parameters to prevent DoS and ensure bounds
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));

    // Fetch recent stake transactions
    const { data: transactions, error: txError } = await supabase
      .from('stake_transactions')
      .select(`
        id,
        type,
        amount,
        status,
        investor_address,
        pool_id,
        created_at,
        transaction_hash,
        pool:loan_pools (
          id,
          name,
          slug
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (txError) {
      console.error('Error fetching transactions:', txError);
    }

    // Format the activity data
    const recentActivity = (transactions || []).map(tx => {
      // Handle pool which could be an array or single object from Supabase
      const pool = Array.isArray(tx.pool) ? tx.pool[0] : tx.pool;
      return {
        id: tx.id,
        type: mapTransactionType(tx.type),
        investor: tx.investor_address ? tx.investor_address.slice(0, 6) + '...' + tx.investor_address.slice(-4) : null,
        borrower: null, // Would come from loan transactions
        pool: pool?.name || 'Unknown Pool',
        poolSlug: pool?.slug,
        amount: tx.amount,
        status: tx.status,
        timestamp: getRelativeTime(new Date(tx.created_at)),
        createdAt: tx.created_at,
        transactionHash: tx.transaction_hash,
      };
    });

    return NextResponse.json({
      activity: recentActivity,
    });
  } catch (error) {
    console.error('Error fetching admin activity:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function mapTransactionType(type: string): string {
  const typeMap: Record<string, string> = {
    'STAKE': 'investment',
    'UNSTAKE': 'withdrawal',
    'CLAIM_REWARDS': 'reward',
    'POOL_DEPOSIT': 'loan',
    'POOL_WITHDRAWAL': 'repayment',
  };
  return typeMap[type] || type.toLowerCase();
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}
