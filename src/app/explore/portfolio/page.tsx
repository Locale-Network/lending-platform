'use client';

import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, DollarSign, PieChart, Activity, Loader2 } from 'lucide-react';
import { ApplyFundingButton } from '@/components/ui/apply-funding-button';
import { PortfolioAllocationChart } from '@/components/portfolio/portfolio-allocation-chart';
import { PortfolioPerformanceChart } from '@/components/portfolio/portfolio-performance-chart';
import { PortfolioQuickActions } from '@/components/portfolio/portfolio-quick-actions';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function PortfolioPage() {
  const { data, error, isLoading } = useSWR('/api/portfolio/stakes', fetcher);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Portfolio</h1>
          <p className="text-muted-foreground">Track your investments across all loan pools</p>
        </div>
        <PortfolioStatsSkeleton />
        <InvestmentListSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Portfolio</h1>
          <p className="text-muted-foreground">Track your investments across all loan pools</p>
        </div>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load portfolio data. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { stakes = [], summary } = data || {};

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Portfolio</h1>
        <p className="text-muted-foreground">Track your investments across all loan pools</p>
      </div>

      <PortfolioStats summary={summary} />

      {/* Charts and Visualizations */}
      {stakes && stakes.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <PortfolioPerformanceChart stakes={stakes} />
          <PortfolioAllocationChart stakes={stakes} />
        </div>
      )}

      {/* Quick Actions */}
      {stakes && stakes.length > 0 && (
        <PortfolioQuickActions />
      )}

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">Active Investments</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="all">All Investments</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <ActiveInvestments stakes={stakes} />
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <CompletedInvestments />
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <AllInvestments stakes={stakes} />
        </TabsContent>
      </Tabs>

      {/* Apply for Funding CTA */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle>Need Funding for Your Business?</CardTitle>
          <CardDescription>Apply for a loan from our lending pools</CardDescription>
        </CardHeader>
        <CardContent>
          <ApplyFundingButton />
        </CardContent>
      </Card>
    </div>
  );
}

function PortfolioStats({ summary }: { summary?: any }) {
  const stats = summary || {
    totalInvested: 0,
    totalValue: 0,
    totalRewards: 0,
    activeInvestments: 0,
    avgReturn: 0,
  };

  const gainPercentage = stats.totalInvested > 0
    ? ((stats.totalValue - stats.totalInvested) / stats.totalInvested * 100).toFixed(2)
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Invested</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${stats.totalInvested.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Across {stats.activeInvestments} pools</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${stats.totalValue.toLocaleString()}</div>
          <p className="text-xs text-green-600">+{gainPercentage}%</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${stats.totalRewards.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Lifetime earnings</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Return</CardTitle>
          <PieChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.avgReturn}%</div>
          <p className="text-xs text-muted-foreground">Annual percentage</p>
        </CardContent>
      </Card>
    </div>
  );
}

function ActiveInvestments({ stakes }: { stakes: any[] }) {
  if (!stakes || stakes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No active investments yet</p>
        <Link href="/explore/pools">
          <button className="text-blue-600 hover:underline">Explore Pools</button>
        </Link>
      </div>
    );
  }

  // Filter only active stakes (pools with ACTIVE status)
  const activeStakes = stakes.filter(stake => stake.pool?.status === 'ACTIVE');

  if (activeStakes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No active investments</p>
        <Link href="/explore/pools">
          <button className="text-blue-600 hover:underline">Explore Pools</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activeStakes.map((stake) => (
        <Card key={stake.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{stake.pool?.name || 'Unknown Pool'}</CardTitle>
                <CardDescription>APY: {stake.pool?.annualizedReturn || 0}%</CardDescription>
              </div>
              <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                {stake.pool?.status || 'Active'}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Invested</p>
                <p className="text-lg font-semibold">${stake.amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Value</p>
                <p className="text-lg font-semibold">${stake.currentValue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Earned</p>
                <p className="text-lg font-semibold text-green-600">+${stake.rewards.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CompletedInvestments() {
  return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">No completed investments yet</p>
    </div>
  );
}

function AllInvestments({ stakes }: { stakes: any[] }) {
  if (!stakes || stakes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No investments yet</p>
        <Link href="/explore/pools">
          <button className="text-blue-600 hover:underline">Explore Pools</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stakes.map((stake) => (
        <Card key={stake.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{stake.pool?.name || 'Unknown Pool'}</CardTitle>
                <CardDescription>APY: {stake.pool?.annualizedReturn || 0}%</CardDescription>
              </div>
              <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                stake.pool?.status === 'ACTIVE'
                  ? 'bg-green-50 text-green-700 ring-green-600/20'
                  : 'bg-gray-50 text-gray-700 ring-gray-600/20'
              }`}>
                {stake.pool?.status || 'Unknown'}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Invested</p>
                <p className="text-lg font-semibold">${stake.amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Value</p>
                <p className="text-lg font-semibold">${stake.currentValue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Earned</p>
                <p className="text-lg font-semibold text-green-600">+${stake.rewards.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PortfolioStatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="space-y-0 pb-2">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function InvestmentListSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, j) => (
                <div key={j}>
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
