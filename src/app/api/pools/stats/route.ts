import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';

// GET /api/pools/stats - Get aggregate statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session || !session.address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use role from session (already fetched from DB in getSession)
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Run pool queries and real aggregation in parallel
    const [pools, realTVL, uniqueInvestors] = await Promise.all([
      prisma.loanPool.findMany({
        select: {
          status: true,
          annualizedReturn: true,
          _count: {
            select: {
              loans: true,
            },
          },
          loans: {
            select: {
              principal: true,
            },
          },
        },
      }),
      // Real TVL from InvestorStake (source of truth)
      prisma.investorStake.aggregate({
        where: { status: 'ACTIVE' },
        _sum: { stakedAmount: true },
      }),
      // Unique investors across all pools
      prisma.investorStake.findMany({
        where: { status: 'ACTIVE' },
        distinct: ['investorAddress'],
        select: { investorAddress: true },
      }),
    ]);

    // Calculate statistics
    const stats = {
      totalPools: pools.length,
      activePools: pools.filter(p => p.status === 'ACTIVE').length,
      draftPools: pools.filter(p => p.status === 'DRAFT').length,
      pausedPools: pools.filter(p => p.status === 'PAUSED').length,
      closedPools: pools.filter(p => p.status === 'CLOSED').length,

      totalValueLocked: realTVL._sum.stakedAmount || 0,

      totalInvestors: uniqueInvestors.length,

      averageAPY:
        pools.filter(p => p.annualizedReturn !== null).length > 0
          ? pools
              .filter(p => p.annualizedReturn !== null)
              .reduce((sum, pool) => sum + (pool.annualizedReturn || 0), 0) /
            pools.filter(p => p.annualizedReturn !== null).length
          : 0,

      totalLoansIssued: pools.reduce((sum, pool) => sum + pool._count.loans, 0),

      totalLoanValue: pools.reduce(
        (sum, pool) => sum + pool.loans.reduce((loanSum, loan) => loanSum + loan.principal, 0),
        0
      ),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching pool stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
