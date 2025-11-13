import { NextRequest, NextResponse } from 'next/server';
import prisma from '@prisma/index';
import { PoolStatus, PoolType } from '@prisma/client';

// GET /api/pools/public - List all ACTIVE pools (public endpoint, no auth required)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as PoolType | null;
    const featured = searchParams.get('featured');

    // Build where clause - only show ACTIVE pools to public
    const where: any = {
      status: 'ACTIVE',
    };

    if (type) where.poolType = type;
    if (featured === 'true') where.isFeatured = true;

    const pools = await prisma.loanPool.findMany({
      where,
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
        totalStaked: true,
        totalInvestors: true,
        availableLiquidity: true,
        annualizedReturn: true,
        imageUrl: true,
        isFeatured: true,
        createdAt: true,
        // Don't expose sensitive fields like minCreditScore, maxLTV, allowedIndustries
      },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json(pools);
  } catch (error) {
    console.error('Error fetching public pools:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
