import { NextRequest, NextResponse } from 'next/server';
import prisma from '@prisma/index';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'pool-public-detail' });

// GET /api/pools/public/[slug] - Get single pool by slug (public endpoint)
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    // Find pool that is either ACTIVE or Coming Soon (DRAFT with isComingSoon)
    const pool = await prisma.loanPool.findFirst({
      where: {
        slug,
        OR: [
          { status: 'ACTIVE' },
          { status: 'DRAFT', isComingSoon: true },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        poolType: true,
        status: true,
        poolSize: true,
        minimumStake: true,
        managementFeeRate: true,
        performanceFeeRate: true,
        baseInterestRate: true,
        riskPremiumMin: true,
        riskPremiumMax: true,
        minCreditScore: true,
        maxLTV: true,
        allowedIndustries: true,
        // Note: totalStaked, totalInvestors, availableLiquidity are aggregated below
        annualizedReturn: true,
        imageUrl: true,
        isFeatured: true,
        isComingSoon: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    // Aggregate real-time statistics from InvestorStake table
    // This replaces the static totalStaked, totalInvestors, availableLiquidity fields
    const stakeAggregation = await prisma.investorStake.aggregate({
      where: {
        poolId: pool.id,
        status: 'ACTIVE', // Use status enum instead of isActive boolean
      },
      _sum: {
        stakedAmount: true, // Field is stakedAmount, not amount
      },
      _count: {
        investorAddress: true,
      },
    });

    // Count unique investors (distinct wallet addresses)
    const uniqueInvestors = await prisma.investorStake.groupBy({
      by: ['investorAddress'],
      where: {
        poolId: pool.id,
        status: 'ACTIVE', // Use status enum instead of isActive boolean
      },
    });

    // Calculate real statistics
    const totalStaked = stakeAggregation._sum.stakedAmount || 0;
    const totalInvestors = uniqueInvestors.length;

    // Available liquidity = pool size - total loans disbursed from this pool
    const loansAggregation = await prisma.poolLoan.aggregate({
      where: {
        poolId: pool.id,
      },
      _sum: {
        principal: true,
      },
    });
    const totalDisbursed = loansAggregation._sum.principal || 0;
    const availableLiquidity = Math.max(0, totalStaked - totalDisbursed);

    return NextResponse.json({
      ...pool,
      // Override with real-time aggregated values
      totalStaked,
      totalInvestors,
      availableLiquidity,
      // Additional computed metrics
      totalDisbursed,
      utilizationRate: totalStaked > 0 ? Math.round((totalDisbursed / totalStaked) * 100) : 0,
    });
  } catch (error) {
    log.error({ err: error }, 'Error fetching pool');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
