'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Wallet, DollarSign, Activity, ArrowRight, Star, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import useSWR from 'swr';

// Types for pool data
interface Pool {
  id: string;
  name: string;
  slug: string;
  description?: string;
  poolType: string;
  poolSize: number;
  totalStaked: number;
  annualizedReturn?: number;
  baseInterestRate: number;
  riskPremiumMin: number;
  riskPremiumMax: number;
  isFeatured: boolean;
}

interface PortfolioSummary {
  totalInvested: number;
  totalRewards: number;
  totalValue: number;
  activeInvestments: number;
  avgReturn: number;
}

interface RecentActivity {
  id: string;
  type: 'stake' | 'unstake';
  pool: string;
  poolSlug?: string;
  amount: number;
  date: string;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

// Helper to get risk level from pool type
function getRiskLevel(poolType: string): string {
  switch (poolType) {
    case 'REAL_ESTATE':
      return 'Low';
    case 'SMALL_BUSINESS':
    case 'MIXED':
      return 'Medium';
    case 'CONSUMER':
      return 'High';
    default:
      return 'Medium';
  }
}

export default function InvestorDashboard() {
  const { address } = useWalletAuth();
  const [featuredPools, setFeaturedPools] = useState<Pool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch portfolio data from blockchain
  const { data: portfolioData } = useSWR(
    address ? `/api/portfolio/stakes?address=${address}` : null,
    fetcher
  );

  // Fetch recent transactions
  const { data: transactionData } = useSWR(
    address ? `/api/stake-transactions?address=${address}` : null,
    fetcher
  );

  // Extract portfolio summary with defaults
  const portfolio: PortfolioSummary = portfolioData?.summary || {
    totalInvested: 0,
    totalRewards: 0,
    totalValue: 0,
    activeInvestments: 0,
    avgReturn: 0,
  };

  // Transform recent transactions to activity format
  const recentActivity: RecentActivity[] = (transactionData?.transactions || [])
    .slice(0, 5)
    .map((tx: any) => ({
      id: tx.id,
      type: tx.type === 'stake' ? 'stake' : 'unstake',
      pool: tx.pool?.name || 'Staking Pool',
      poolSlug: tx.pool?.slug,
      amount: tx.amount,
      date: new Date(tx.created_at).toLocaleDateString(),
    }));

  // Fetch featured pools from API
  useEffect(() => {
    async function fetchFeaturedPools() {
      try {
        setIsLoading(true);
        // First try to get featured pools, fallback to all active pools
        let response = await fetch('/api/pools/public?featured=true');
        if (!response.ok) throw new Error('Failed to fetch pools');

        let pools = await response.json();

        // If no featured pools, get all active pools (limit to 3)
        if (pools.length === 0) {
          response = await fetch('/api/pools/public');
          if (!response.ok) throw new Error('Failed to fetch pools');
          pools = await response.json();
        }

        // Limit to first 3 pools for featured section
        setFeaturedPools(pools.slice(0, 3));
      } catch (err) {
        console.error('Error fetching pools:', err);
        setError(err instanceof Error ? err.message : 'Failed to load pools');
      } finally {
        setIsLoading(false);
      }
    }

    fetchFeaturedPools();
  }, []);

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>

      {/* Portfolio Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Portfolio</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{portfolio.totalValue.toLocaleString()} USDC</div>
            <p className="text-xs text-muted-foreground">
              {portfolio.totalRewards > 0 ? `+${portfolio.totalRewards.toLocaleString()} USDC from initial` : 'Connect wallet to view'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staked</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{portfolio.totalInvested.toLocaleString()} USDC</div>
            <p className="text-xs text-muted-foreground">Across {portfolio.activeInvestments} pools</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rewards</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {portfolio.totalRewards.toLocaleString()} USDC
            </div>
            <p className="text-xs text-muted-foreground">All-time earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average APY</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{portfolio.avgReturn}%</div>
            <p className="text-xs text-muted-foreground">Weighted across pools</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Get started with your investments</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Link href="/explore/pools" className="flex-1">
            <Button className="w-full" size="lg">
              <Wallet className="mr-2 h-4 w-4" />
              Explore Pools
            </Button>
          </Link>
          <Link href="/explore/portfolio" className="flex-1">
            <Button variant="outline" className="w-full" size="lg">
              <Activity className="mr-2 h-4 w-4" />
              View Portfolio
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Featured Pools */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Featured Pools</CardTitle>
                <CardDescription>Top performing investment opportunities</CardDescription>
              </div>
              <Link href="/explore/pools">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading pools...</span>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">
                <p>{error}</p>
                <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="mt-2">
                  Retry
                </Button>
              </div>
            ) : featuredPools.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No active pools available yet.</p>
                <p className="text-sm mt-1">Check back soon for investment opportunities!</p>
              </div>
            ) : (
              featuredPools.map(pool => {
                // Calculate estimated APY from base rate + risk premium midpoint
                const estimatedApy = pool.annualizedReturn ||
                  (pool.baseInterestRate + (pool.riskPremiumMin + pool.riskPremiumMax) / 2);

                return (
                  <div key={pool.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{pool.name}</p>
                        {pool.isFeatured && (
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        )}
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>APY: {estimatedApy.toFixed(1)}%</span>
                        <span>TVL: {(pool.totalStaked / 1000000).toFixed(2)}M USDC</span>
                        <span className="text-blue-600">{getRiskLevel(pool.poolType)} Risk</span>
                      </div>
                    </div>
                    <Link href={`/explore/pools/${pool.slug}`}>
                      <Button size="sm">Stake</Button>
                    </Link>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Your latest transactions</CardDescription>
              </div>
              <Link href="/explore/portfolio">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!address ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Connect your wallet to see activity</p>
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No recent activity</p>
                <p className="text-sm mt-1">Start investing to see your transactions here</p>
              </div>
            ) : (
              recentActivity.map(activity => (
                <div key={activity.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          activity.type === 'stake'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {activity.type === 'stake' ? 'Staked' : 'Unstaked'}
                      </span>
                      {activity.poolSlug ? (
                        <Link href={`/explore/pools/${activity.poolSlug}`} className="font-medium hover:underline">
                          {activity.pool}
                        </Link>
                      ) : (
                        <p className="font-medium">{activity.pool}</p>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{activity.date}</p>
                  </div>
                  <p className={`font-semibold ${activity.type === 'stake' ? 'text-green-600' : 'text-orange-600'}`}>
                    {activity.type === 'stake' ? '+' : '-'}{activity.amount.toLocaleString()} USDC
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
