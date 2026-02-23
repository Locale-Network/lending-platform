import { NextRequest, NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { getSession } from '@/lib/auth/authorization';
import { checkRateLimit, rateLimitHeaders, rateLimits } from '@/lib/rate-limit';
import {
  setInvestorStatus,
  getInvestorStatus,
  canInvest,
  hasInvested,
  getRegistryStats,
} from '@/services/contracts/eligibilityRegistry';
import { STATUS_LABELS } from '@/lib/contracts/eligibilityRegistry';

/**
 * GET /api/admin/investor-eligibility?addresses=0x...,0x...
 *
 * Returns eligibility status for given addresses, plus registry stats.
 * If no addresses provided, returns only stats.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.address || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const stats = await getRegistryStats();

    const addressesParam = request.nextUrl.searchParams.get('addresses');
    if (!addressesParam) {
      return NextResponse.json({ investors: [], stats });
    }

    const addresses = addressesParam
      .split(',')
      .map((a) => a.trim())
      .filter((a) => isAddress(a));

    if (addresses.length === 0) {
      return NextResponse.json({ error: 'No valid addresses provided' }, { status: 400 });
    }

    // Limit to 20 addresses per request to avoid timeouts
    const limited = addresses.slice(0, 20);

    const investors = await Promise.all(
      limited.map(async (address) => {
        const addr = address as `0x${string}`;
        const [status, invested, investResult] = await Promise.all([
          getInvestorStatus(addr),
          hasInvested(addr),
          canInvest(addr),
        ]);
        return {
          address,
          status,
          statusLabel: STATUS_LABELS[status] || 'Unknown',
          hasInvested: invested,
          canInvest: investResult.canInvest,
          reason: investResult.reason,
        };
      })
    );

    return NextResponse.json({ investors, stats });
  } catch (error) {
    console.error('[/api/admin/investor-eligibility GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/investor-eligibility
 *
 * Set eligibility status for an investor on-chain.
 * Body: { address: "0x...", status: 0 | 1 | 2 }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.address || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rateLimitResult = await checkRateLimit(
      `admin-eligibility:${session.address}`,
      { limit: 10, windowSeconds: 60 }
    );
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again shortly.' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    const body = await request.json();
    const { address, status } = body;

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    if (status === undefined || ![0, 1, 2].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be 0 (Ineligible), 1 (Accredited), or 2 (Non-Accredited)' },
        { status: 400 }
      );
    }

    const result = await setInvestorStatus(address as `0x${string}`, status);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Transaction failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      statusLabel: STATUS_LABELS[status],
    });
  } catch (error) {
    console.error('[/api/admin/investor-eligibility POST] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
