import { NextRequest, NextResponse } from 'next/server';
import prisma from '@prisma/index';
import { PoolType } from '@prisma/client';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'pools-public' });

// GET /api/pools/public - List ACTIVE pools and Coming Soon pools (public endpoint)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as PoolType | null;
    const featured = searchParams.get('featured');
    const comingSoon = searchParams.get('comingSoon');

    // Build where clause - show ACTIVE pools OR DRAFT pools marked as Coming Soon
    const baseCondition = {
      OR: [
        { status: 'ACTIVE' as const },
        { status: 'DRAFT' as const, isComingSoon: true },
      ],
    };

    const where: any = { ...baseCondition };

    if (type) where.poolType = type;
    if (featured === 'true') where.isFeatured = true;
    if (comingSoon === 'true') {
      // Filter to only Coming Soon pools
      where.OR = [{ status: 'DRAFT' as const, isComingSoon: true }];
    }

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
        isComingSoon: true,
        createdAt: true,
        // Don't expose sensitive fields like minCreditScore, maxLTV, allowedIndustries
      },
      orderBy: [{ isFeatured: 'desc' }, { isComingSoon: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json(pools);
  } catch (error) {
    log.error({ err: error }, 'Error fetching public pools');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
