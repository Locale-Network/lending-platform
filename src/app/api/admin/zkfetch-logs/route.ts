import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import {
  getAllLogs,
  getAllProofs,
  getZkFetchStats,
  ZkFetchAction,
} from '@/services/zkFetch/zkFetchLogger';

/**
 * GET /api/admin/zkfetch-logs
 *
 * Fetch zkFetch logs, proofs, and statistics for the admin dashboard.
 * Requires ADMIN role.
 *
 * Query params:
 * - view: 'logs' | 'proofs' | 'stats' (default: 'logs')
 * - page: number (default: 1)
 * - limit: number (default: 50)
 * - action: 'sync' | 'verify' | 'submit' | 'relay' (optional)
 * - success: 'true' | 'false' (optional)
 * - loanId: string (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const session = await getSession();
    if (!session?.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query params with validation
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'logs';
    // SECURITY: Validate pagination parameters to prevent DoS and ensure bounds
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const action = searchParams.get('action') as ZkFetchAction | null;
    const successParam = searchParams.get('success');
    const success = successParam === 'true' ? true : successParam === 'false' ? false : undefined;
    const loanId = searchParams.get('loanId') || undefined;
    const borrowerAddress = searchParams.get('borrowerAddress') || undefined;

    // Fetch data based on view
    if (view === 'stats') {
      const stats = await getZkFetchStats();
      return NextResponse.json({ stats });
    }

    if (view === 'proofs') {
      const verified = searchParams.get('verified');
      const data = await getAllProofs({
        page,
        limit,
        loanId,
        borrowerAddress,
        verified: verified === 'true' ? true : verified === 'false' ? false : undefined,
      });
      return NextResponse.json(data);
    }

    // Default: logs
    const data = await getAllLogs({
      page,
      limit,
      action: action || undefined,
      success,
      loanId,
      borrowerAddress,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] zkfetch-logs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch zkFetch logs' },
      { status: 500 }
    );
  }
}
