import { NextRequest, NextResponse } from 'next/server';
import prisma from '@prisma/index';

// GET /api/pools/public/[slug] - Get single pool by slug (public endpoint)
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const pool = await prisma.loanPool.findUnique({
      where: {
        slug,
        status: 'ACTIVE', // Only show active pools
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
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    return NextResponse.json(pool);
  } catch (error) {
    console.error('Error fetching pool:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
