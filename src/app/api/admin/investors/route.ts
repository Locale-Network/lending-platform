import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import prisma from '@prisma/index';

// GET /api/admin/investors - Get all investors with their stakes and stats
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

    // Get all accounts that have stakes (investors)
    const investorStakes = await prisma.investorStake.findMany({
      include: {
        pool: true,
        investor: true,
      },
    });

    // Group stakes by investor
    const investorMap = new Map<string, {
      address: string;
      shortAddress: string;
      totalInvested: number;
      activeInvestments: number;
      totalReturns: number;
      stakes: typeof investorStakes;
      joinedDate: Date;
      email?: string | null;
      verified: boolean;
    }>();

    for (const stake of investorStakes) {
      const addr = stake.investorAddress;
      const existing = investorMap.get(addr);

      if (existing) {
        existing.totalInvested += stake.stakedAmount;
        existing.totalReturns += stake.earnedInterest;
        if (stake.status === 'ACTIVE') {
          existing.activeInvestments += 1;
        }
        existing.stakes.push(stake);
        // Update joined date if this stake is earlier
        if (stake.stakedAt < existing.joinedDate) {
          existing.joinedDate = stake.stakedAt;
        }
      } else {
        investorMap.set(addr, {
          address: addr,
          shortAddress: addr.slice(0, 6) + '...' + addr.slice(-4),
          totalInvested: stake.stakedAmount,
          activeInvestments: stake.status === 'ACTIVE' ? 1 : 0,
          totalReturns: stake.earnedInterest,
          stakes: [stake],
          joinedDate: stake.stakedAt,
          email: stake.investor.email,
          verified: !!stake.investor.email, // Consider verified if they have email
        });
      }
    }

    // Convert to array and calculate additional metrics
    const investors = Array.from(investorMap.values()).map(investor => {
      // Calculate average APY across all active stakes
      const activeStakes = investor.stakes.filter(s => s.status === 'ACTIVE');
      const avgAPY = activeStakes.length > 0
        ? activeStakes.reduce((sum, s) => sum + (s.pool.annualizedReturn || 0), 0) / activeStakes.length
        : 0;

      // Determine tier based on total invested
      let tier = 'bronze';
      if (investor.totalInvested >= 500000) tier = 'platinum';
      else if (investor.totalInvested >= 100000) tier = 'gold';
      else if (investor.totalInvested >= 25000) tier = 'silver';

      return {
        id: investor.address,
        address: investor.address,
        shortAddress: investor.shortAddress,
        totalInvested: investor.totalInvested,
        activeInvestments: investor.activeInvestments,
        totalReturns: Math.round(investor.totalReturns),
        avgAPY: Math.round(avgAPY * 10) / 10,
        joinedDate: investor.joinedDate.toISOString().split('T')[0],
        tier,
        verified: investor.verified,
        email: investor.email,
      };
    });

    // Sort by total invested (descending)
    investors.sort((a, b) => b.totalInvested - a.totalInvested);

    // Calculate summary stats
    const totalInvestors = investors.length;
    const totalInvested = investors.reduce((sum, inv) => sum + inv.totalInvested, 0);
    const totalReturns = investors.reduce((sum, inv) => sum + inv.totalReturns, 0);
    const avgInvestment = totalInvestors > 0 ? totalInvested / totalInvestors : 0;
    const verifiedCount = investors.filter(i => i.verified).length;

    return NextResponse.json({
      investors,
      summary: {
        totalInvestors,
        totalInvested,
        totalReturns,
        avgInvestment,
        verifiedCount,
      },
    });
  } catch (error) {
    console.error('Error fetching investors:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
