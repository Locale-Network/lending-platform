import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'admin-dashboard' });

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
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Optimized: Run all queries in parallel with selective fields
    const [
      poolStats,
      uniqueInvestorCount,
      approvedLoansCount,
      totalLoanValue,
      recentLoansData,
      activePoolsData,
    ] = await Promise.all([
      // Pool stats using aggregation - avoids loading all pool data
      prisma.loanPool.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { totalStaked: true, managementFeeRate: true },
        _avg: { annualizedReturn: true },
      }),

      // Unique investors count - distinct query
      prisma.investorStake.findMany({
        distinct: ['investorAddress'],
        select: { investorAddress: true },
      }),

      // Approved loans count
      prisma.loanApplication.count({
        where: { status: 'APPROVED' },
      }),

      // Total loan value from pool loans
      prisma.poolLoan.aggregate({
        _sum: { principal: true },
      }),

      // Recent loan applications - limited and selective
      prisma.loanApplication.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          accountAddress: true,
          amount: true,
          status: true,
          businessLegalName: true,
          createdAt: true,
        },
      }),

      // Active pools - limited and selective
      prisma.loanPool.findMany({
        where: { status: 'ACTIVE' },
        take: 5,
        orderBy: { totalStaked: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          totalStaked: true,
          totalInvestors: true,
          annualizedReturn: true,
          baseInterestRate: true,
          riskPremiumMin: true,
          riskPremiumMax: true,
        },
      }),
    ]);

    // Process pool stats from groupBy result
    const statusCounts = poolStats.reduce(
      (acc, stat) => {
        acc[stat.status] = stat._count.id;
        acc.totalTVL += stat._sum.totalStaked || 0;
        acc.totalMgmtFees += (stat._sum.totalStaked || 0) * (stat._sum.managementFeeRate || 0) / 100;
        return acc;
      },
      { ACTIVE: 0, DRAFT: 0, PAUSED: 0, CLOSED: 0, totalTVL: 0, totalMgmtFees: 0 } as Record<string, number>
    );

    const totalPools = poolStats.reduce((sum, stat) => sum + stat._count.id, 0);

    // Calculate average APY from active pools
    const activePoolStat = poolStats.find(s => s.status === 'ACTIVE');
    const averageAPY = activePoolStat?._avg?.annualizedReturn || 0;

    // Transform recent loans
    const recentLoans = recentLoansData.map(loan => ({
      id: loan.id,
      borrower: loan.accountAddress.slice(0, 6) + '...' + loan.accountAddress.slice(-4),
      amount: loan.amount || 0,
      status: loan.status.toLowerCase(),
      businessName: loan.businessLegalName,
      date: getRelativeTime(loan.createdAt),
      createdAt: loan.createdAt,
    }));

    // Transform active pools
    const activePools = activePoolsData.map(pool => ({
      id: pool.id,
      name: pool.name,
      slug: pool.slug,
      tvl: pool.totalStaked,
      investors: pool.totalInvestors,
      apy: pool.annualizedReturn || (pool.baseInterestRate + (pool.riskPremiumMin + pool.riskPremiumMax) / 2),
    }));

    return NextResponse.json({
      stats: {
        totalValueLocked: statusCounts.totalTVL,
        tvlChange: 0, // Would need historical data to calculate
        totalLoans: approvedLoansCount,
        loansChange: 0,
        activeInvestors: uniqueInvestorCount.length,
        investorsChange: 0,
        platformRevenue: Math.round(statusCounts.totalMgmtFees),
        revenueChange: 0,
      },
      poolStats: {
        totalPools,
        activePools: statusCounts.ACTIVE,
        draftPools: statusCounts.DRAFT,
        pausedPools: statusCounts.PAUSED,
        closedPools: statusCounts.CLOSED,
        averageAPY,
        totalLoanValue: totalLoanValue._sum.principal || 0,
        totalLoansIssued: approvedLoansCount,
      },
      recentLoans,
      activePools,
    });
  } catch (error) {
    log.error({ err: error }, 'Error fetching admin dashboard');
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
