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
        totalStaked: true,
        totalInvestors: true,
        availableLiquidity: true,
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

    return NextResponse.json(pool);
  } catch (error) {
    log.error({ err: error }, 'Error fetching pool');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
