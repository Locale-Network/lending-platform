import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';

// GET /api/admin/dashboard - Get comprehensive admin dashboard stats
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

    // Get all pools with their stakes and loans
    const pools = await prisma.loanPool.findMany({
      include: {
        stakes: {
          include: {
            investor: true,
          },
        },
        loans: {
          include: {
            loanApplication: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get all investors with stakes
    const investorStakes = await prisma.investorStake.findMany({
      include: {
        pool: true,
        investor: true,
      },
    });

    // Get loan applications
    const loanApplications = await prisma.loanApplication.findMany({
      include: {
        poolLoans: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate stats
    const totalPools = pools.length;
    const activePools = pools.filter(p => p.status === 'ACTIVE').length;
    const draftPools = pools.filter(p => p.status === 'DRAFT').length;
    const pausedPools = pools.filter(p => p.status === 'PAUSED').length;
    const closedPools = pools.filter(p => p.status === 'CLOSED').length;

    // Total Value Locked across all pools
    const totalValueLocked = pools.reduce((sum, pool) => sum + pool.totalStaked, 0);

    // Unique investors (by address)
    const uniqueInvestors = new Set(investorStakes.map(s => s.investorAddress)).size;

    // Calculate average APY from active pools with annualized return
    const poolsWithAPY = pools.filter(p => p.status === 'ACTIVE' && p.annualizedReturn !== null);
    const averageAPY = poolsWithAPY.length > 0
      ? poolsWithAPY.reduce((sum, pool) => sum + (pool.annualizedReturn || 0), 0) / poolsWithAPY.length
      : 0;

    // Total loans and loan value
    const totalLoans = loanApplications.filter(l => l.status === 'APPROVED').length;
    const totalLoanValue = pools.reduce(
      (sum, pool) => sum + pool.loans.reduce((loanSum, loan) => loanSum + loan.principal, 0),
      0
    );

    // Platform revenue (management + performance fees earned)
    // Simplified calculation: management fee on TVL
    const managementFeesEarned = pools.reduce((sum, pool) => {
      return sum + (pool.totalStaked * pool.managementFeeRate / 100);
    }, 0);

    // Recent loan applications
    const recentLoans = loanApplications
      .slice(0, 5)
      .map(loan => ({
        id: loan.id,
        borrower: loan.accountAddress.slice(0, 6) + '...' + loan.accountAddress.slice(-4),
        amount: loan.amount || 0,
        status: loan.status.toLowerCase(),
        businessName: loan.businessLegalName,
        date: getRelativeTime(loan.createdAt),
        createdAt: loan.createdAt,
      }));

    // Active pools data
    const activePoolsData = pools
      .filter(p => p.status === 'ACTIVE')
      .slice(0, 5)
      .map(pool => ({
        id: pool.id,
        name: pool.name,
        slug: pool.slug,
        tvl: pool.totalStaked,
        investors: pool.totalInvestors,
        apy: pool.annualizedReturn || (pool.baseInterestRate + (pool.riskPremiumMin + pool.riskPremiumMax) / 2),
      }));

    return NextResponse.json({
      stats: {
        totalValueLocked,
        tvlChange: 0, // Would need historical data to calculate
        totalLoans,
        loansChange: 0,
        activeInvestors: uniqueInvestors,
        investorsChange: 0,
        platformRevenue: Math.round(managementFeesEarned),
        revenueChange: 0,
      },
      poolStats: {
        totalPools,
        activePools,
        draftPools,
        pausedPools,
        closedPools,
        averageAPY,
        totalLoanValue,
        totalLoansIssued: totalLoans,
      },
      recentLoans,
      activePools: activePoolsData,
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
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
