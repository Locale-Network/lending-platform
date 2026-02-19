import { NextRequest, NextResponse } from 'next/server';
import prisma from '@prisma/index';
import { PoolType, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { checkRateLimit, getClientIp, rateLimitHeaders, rateLimits } from '@/lib/rate-limit';

const log = logger.child({ module: 'pools-public' });

// GET /api/pools/public - List ACTIVE pools and Coming Soon pools (public endpoint)
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Rate limiting on public endpoint to prevent abuse
    const clientIp = await getClientIp();
    const rateLimitResult = await checkRateLimit(`public-pools:${clientIp}`, rateLimits.api);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type');
    const featured = searchParams.get('featured');
    const comingSoon = searchParams.get('comingSoon');

    // SECURITY: Validate type param against enum to prevent injection
    const validTypes = Object.values(PoolType);
    if (typeParam && !validTypes.includes(typeParam as PoolType)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Build where clause - show ACTIVE pools OR DRAFT pools marked as Coming Soon
    const baseCondition = {
      OR: [
        { status: 'ACTIVE' as const },
        { status: 'DRAFT' as const, isComingSoon: true },
      ],
    };

    const where: Prisma.LoanPoolWhereInput = { ...baseCondition };

    if (typeParam) where.poolType = typeParam as PoolType;
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
        availableLiquidity: true,
        annualizedReturn: true,
        borrowerType: true,
        compositeRiskTier: true,
        imageUrl: true,
        isFeatured: true,
        isComingSoon: true,
        createdAt: true,
        // Don't expose sensitive fields like minCreditScore, maxLTV, allowedIndustries
      },
      orderBy: [{ isFeatured: 'desc' }, { isComingSoon: 'desc' }, { createdAt: 'desc' }],
    });

    // Aggregate real-time stats from InvestorStake for each pool
    const poolIds = pools.map(p => p.id);

    const [stakeAggregations, uniqueInvestorCounts, loanAggregations, poolLoans] = await Promise.all([
      // Total staked per pool
      prisma.investorStake.groupBy({
        by: ['poolId'],
        where: { poolId: { in: poolIds }, status: 'ACTIVE' },
        _sum: { stakedAmount: true },
      }),
      // Unique investors per pool
      prisma.investorStake.groupBy({
        by: ['poolId', 'investorAddress'],
        where: { poolId: { in: poolIds }, status: 'ACTIVE' },
      }),
      // Total disbursed per pool
      prisma.poolLoan.groupBy({
        by: ['poolId'],
        where: { poolId: { in: poolIds } },
        _sum: { principal: true },
      }),
      // Interest rates per pool (for weighted average borrower rate)
      prisma.poolLoan.findMany({
        where: { poolId: { in: poolIds } },
        select: { poolId: true, principal: true, interestRate: true },
      }),
    ]);

    // Build lookup maps
    const stakedByPool = new Map(stakeAggregations.map(s => [s.poolId, s._sum.stakedAmount || 0]));
    const investorsByPool = new Map<string, number>();
    for (const row of uniqueInvestorCounts) {
      investorsByPool.set(row.poolId, (investorsByPool.get(row.poolId) || 0) + 1);
    }
    const disbursedByPool = new Map(loanAggregations.map(l => [l.poolId, l._sum.principal || 0]));

    // Compute weighted average borrower interest rate per pool
    const loansByPool = new Map<string, Array<{ principal: number; interestRate: number }>>();
    for (const loan of poolLoans) {
      const arr = loansByPool.get(loan.poolId) || [];
      arr.push({ principal: loan.principal, interestRate: loan.interestRate });
      loansByPool.set(loan.poolId, arr);
    }
    const weightedRateByPool = new Map<string, number>();
    for (const [poolId, loans] of loansByPool) {
      const withRate = loans.filter(l => l.interestRate > 0);
      if (withRate.length === 0) continue;
      const weightedSum = withRate.reduce((sum, l) => sum + l.interestRate * l.principal, 0);
      const totalPrincipal = withRate.reduce((sum, l) => sum + l.principal, 0);
      if (totalPrincipal > 0) {
        weightedRateByPool.set(poolId, weightedSum / totalPrincipal);
      }
    }

    const enrichedPools = pools.map(pool => {
      const totalStaked = stakedByPool.get(pool.id) || 0;
      const totalDisbursed = disbursedByPool.get(pool.id) || 0;
      const avgRate = weightedRateByPool.get(pool.id) || null;

      // Compute risk level from compositeRiskTier (DB) or weighted avg interest rate
      let riskLevel: string;
      if (pool.compositeRiskTier) {
        // Use stored composite risk tier (e.g. "Low Risk" → "Low")
        riskLevel = pool.compositeRiskTier.replace(' Risk', '');
      } else if (avgRate) {
        // Derive from weighted avg borrower rate (basis points)
        // Higher rates = riskier borrowers = higher pool risk
        if (avgRate <= 900) riskLevel = 'Low';
        else if (avgRate <= 1050) riskLevel = 'Moderate';
        else if (avgRate <= 1200) riskLevel = 'Medium';
        else if (avgRate <= 1350) riskLevel = 'High';
        else riskLevel = 'Very High';
      } else {
        riskLevel = 'Medium'; // Default for pools with no loans
      }

      return {
        ...pool,
        totalStaked,
        totalInvestors: investorsByPool.get(pool.id) || 0,
        availableLiquidity: Math.max(0, totalStaked - totalDisbursed),
        borrowerInterestRate: avgRate,
        riskLevel,
      };
    });

    return NextResponse.json(enrichedPools);
  } catch (error) {
    log.error({ err: error }, 'Error fetching public pools');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
