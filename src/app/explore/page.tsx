'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Wallet, DollarSign, Activity, ArrowRight, Star } from 'lucide-react';
import Link from 'next/link';

// Mock data
const mockPortfolio = {
  totalValue: 45250,
  totalStaked: 40000,
  totalRewards: 5250,
  activeStakes: 3,
  apy: 13.1,
};

const mockFeaturedPools = [
  {
    id: '1',
    name: 'Small Business Growth Pool',
    slug: 'small-business-growth',
    apy: 12.5,
    tvl: 1250000,
    risk: 'Medium',
  },
  {
    id: '2',
    name: 'Real Estate Ventures',
    slug: 'real-estate-ventures',
    apy: 10.8,
    tvl: 2800000,
    risk: 'Low',
  },
];

const mockRecentActivity = [
  {
    id: '1',
    type: 'stake',
    pool: 'Small Business Growth Pool',
    amount: 10000,
    date: '2 hours ago',
  },
  {
    id: '2',
    type: 'reward',
    pool: 'Real Estate Ventures',
    amount: 125.5,
    date: '1 day ago',
  },
  {
    id: '3',
    type: 'stake',
    pool: 'Working Capital Pool',
    amount: 15000,
    date: '3 days ago',
  },
];

export default function InvestorDashboard() {
  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Here&apos;s an overview of your portfolio and recent activity
        </p>
      </div>

      {/* Portfolio Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Portfolio</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${mockPortfolio.totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +${mockPortfolio.totalRewards.toLocaleString()} from initial
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staked</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${mockPortfolio.totalStaked.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across {mockPortfolio.activeStakes} pools</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rewards</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${mockPortfolio.totalRewards.toLocaleString()}
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
            <div className="text-2xl font-bold">{mockPortfolio.apy}%</div>
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
            {mockFeaturedPools.map(pool => (
              <div key={pool.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{pool.name}</p>
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  </div>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>APY: {pool.apy}%</span>
                    <span>TVL: ${(pool.tvl / 1000000).toFixed(1)}M</span>
                    <span className="text-blue-600">{pool.risk} Risk</span>
                  </div>
                </div>
                <Link href={`/explore/pools/${pool.slug}`}>
                  <Button size="sm">Stake</Button>
                </Link>
              </div>
            ))}
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
              <Link href="/explore/transactions">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {mockRecentActivity.map(activity => (
              <div key={activity.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        activity.type === 'stake'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {activity.type === 'stake' ? 'Staked' : 'Reward'}
                    </span>
                    <p className="font-medium">{activity.pool}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{activity.date}</p>
                </div>
                <p className="font-semibold">
                  {activity.type === 'stake' ? '' : '+'}${activity.amount.toLocaleString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
