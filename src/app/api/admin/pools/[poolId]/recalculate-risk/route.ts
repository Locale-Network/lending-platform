import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import { Role } from '@prisma/client';
import { calculateAndStorePoolRisk } from '@/services/risk';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rate-limit';

/**
 * POST /api/admin/pools/[poolId]/recalculate-risk
 *
 * Manually trigger composite risk score recalculation for a specific pool.
 * Admin-only endpoint.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ poolId: string }> }
) {
  try {
    // Check admin authorization
    const session = await getSession();
    if (!session || session.user.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }

    // SECURITY: Rate limiting on risk recalculation (database intensive)
    const clientIp = await getClientIp();
    const rateLimitResult = await checkRateLimit(
      `recalculate-risk:${session.address}`,
      { limit: 20, windowSeconds: 3600 } // 20 recalculations per hour
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many recalculation requests. Please wait before trying again.' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    const { poolId } = await params;

    // Verify pool exists
    const pool = await prisma.loanPool.findUnique({
      where: { id: poolId },
      select: { id: true, name: true, borrowerType: true },
    });

    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    // Skip for single-borrower pools (composite scoring N/A)
    if (pool.borrowerType === 'SINGLE_BORROWER') {
      return NextResponse.json({
        success: true,
        message: 'Composite scoring is not applicable for single-borrower pools',
        poolId: pool.id,
        poolName: pool.name,
        borrowerType: pool.borrowerType,
      });
    }

    // Calculate and store composite risk
    const startTime = Date.now();
    const result = await calculateAndStorePoolRisk(poolId);
    const durationMs = Date.now() - startTime;

    if (!result) {
      return NextResponse.json({
        success: true,
        message: 'Pool has fewer than 2 loans - composite score not calculated',
        poolId: pool.id,
        poolName: pool.name,
      });
    }

    return NextResponse.json({
      success: true,
      poolId: pool.id,
      poolName: pool.name,
      compositeRiskScore: result.compositeScore,
      riskTier: result.riskTier,
      weightedAvgDscr: result.weightedDscr,
      weightedAvgRate: result.weightedRate,
      diversificationScore: result.diversificationScore,
      hhiIndex: result.hhiIndex,
      durationMs,
    });
  } catch (error) {
    console.error('[Admin] Error recalculating pool risk:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate composite risk' },
      { status: 500 }
    );
  }
}
