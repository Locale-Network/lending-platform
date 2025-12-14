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

    // Check if user is admin
    const user = await prisma.account.findUnique({
      where: { address: session.address },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Get all pools for calculations
    const pools = await prisma.loanPool.findMany({
      select: {
        status: true,
        totalStaked: true,
        totalInvestors: true,
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
    });

    // Calculate statistics
    const stats = {
      totalPools: pools.length,
      activePools: pools.filter(p => p.status === 'ACTIVE').length,
      draftPools: pools.filter(p => p.status === 'DRAFT').length,
      pausedPools: pools.filter(p => p.status === 'PAUSED').length,
      closedPools: pools.filter(p => p.status === 'CLOSED').length,

      totalValueLocked: pools.reduce((sum, pool) => sum + pool.totalStaked, 0),

      totalInvestors: pools.reduce((sum, pool) => sum + pool.totalInvestors, 0),

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
