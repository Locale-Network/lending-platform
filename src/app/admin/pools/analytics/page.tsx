'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp,
  DollarSign,
  Users,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function AnalyticsPage() {
  const { data: dashboardData, error: dashError, isLoading: dashLoading } = useSWR('/api/admin/dashboard', fetcher);
  const { data: poolsData, error: poolsError, isLoading: poolsLoading } = useSWR('/api/pools', fetcher);
  const { data: activityData, error: activityError, isLoading: activityLoading } = useSWR('/api/admin/activity', fetcher);

  const isLoading = dashLoading || poolsLoading || activityLoading;
  const error = dashError || poolsError || activityError;

  const analyticsData = {
    totalRevenue: dashboardData?.stats?.platformRevenue || 0,
    revenueChange: dashboardData?.stats?.revenueChange || 0,
    totalLoansIssued: dashboardData?.poolStats?.totalLoansIssued || 0,
    loansChange: dashboardData?.stats?.loansChange || 0,
    activeInvestors: dashboardData?.stats?.activeInvestors || 0,
    investorsChange: dashboardData?.stats?.investorsChange || 0,
    averageReturn: dashboardData?.poolStats?.averageAPY || 0,
    returnChange: 0,
  };

  const recentActivity = activityData?.activity || [];

  // Format pool performance data from pools API
  const poolPerformance = (Array.isArray(poolsData) ? poolsData : [])
    .filter((pool: any) => pool.status === 'ACTIVE')
    .slice(0, 6)
    .map((pool: any) => ({
      id: pool.id,
      name: pool.name,
      slug: pool.slug,
      apy: pool.annualizedReturn || 0,
      tvl: pool.totalStaked || 0,
      growth: 0, // Would need historical data
      investors: pool.totalInvestors || 0,
    }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load analytics data. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Monitor platform performance and key metrics
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.totalRevenue.toLocaleString()} USDC</div>
            <div className="flex items-center text-xs text-green-600 mt-1">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              {analyticsData.revenueChange}% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Loans Issued</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.totalLoansIssued}</div>
            <div className="flex items-center text-xs text-green-600 mt-1">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              {analyticsData.loansChange}% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Investors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.activeInvestors}</div>
            <div className="flex items-center text-xs text-red-600 mt-1">
              <ArrowDownRight className="h-3 w-3 mr-1" />
              {Math.abs(analyticsData.investorsChange)}% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Return</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.averageReturn}%</div>
            <div className="flex items-center text-xs text-green-600 mt-1">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              {analyticsData.returnChange}% from last month
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pool Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Pool Performance</CardTitle>
          <CardDescription>Performance metrics across all lending pools</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {poolPerformance.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No active pools yet</p>
            ) : (
              poolPerformance.map((pool: any) => (
                <div key={pool.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex-1">
                    <p className="font-semibold">{pool.name}</p>
                    <p className="text-sm text-muted-foreground">
                      TVL: {pool.tvl >= 1000000 ? (pool.tvl / 1000000).toFixed(1) + 'M' : (pool.tvl / 1000).toFixed(0) + 'K'} USDC • {pool.investors} investors
                    </p>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">APY</p>
                      <p className="font-semibold text-green-600">{pool.apy?.toFixed(1) || 'N/A'}%</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest transactions across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No recent activity</p>
            ) : (
              recentActivity.map((activity: any) => (
                <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          activity.type === 'investment'
                            ? 'bg-blue-100 text-blue-800'
                            : activity.type === 'loan'
                              ? 'bg-green-100 text-green-800'
                              : activity.type === 'withdrawal'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {activity.type.toUpperCase()}
                      </span>
                      <p className="font-medium">{activity.pool}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {activity.investor || activity.borrower || 'Unknown'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{(activity.amount || 0).toLocaleString()} USDC</p>
                    <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
