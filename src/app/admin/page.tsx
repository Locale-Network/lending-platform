'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  TrendingUp,
  Users,
  Activity,
  ArrowUpRight,
  AlertCircle,
  CheckCircle,
  Clock,
  Waves,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import CoverflowCarousel from '@/components/ui/coverflow-carousel';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
  active: { label: 'Active', icon: Activity, color: 'bg-blue-100 text-blue-800' },
  rejected: { label: 'Rejected', icon: AlertCircle, color: 'bg-red-100 text-red-800' },
  draft: { label: 'Draft', icon: Clock, color: 'bg-gray-100 text-gray-800' },
  additional_info_needed: { label: 'Info Needed', icon: AlertCircle, color: 'bg-orange-100 text-orange-800' },
};

export default function AdminDashboard() {
  const { data, error, isLoading } = useSWR('/api/admin/dashboard', fetcher);

  const dashboardStats = data?.stats || {
    totalValueLocked: 0,
    tvlChange: 0,
    totalLoans: 0,
    loansChange: 0,
    activeInvestors: 0,
    investorsChange: 0,
    platformRevenue: 0,
    revenueChange: 0,
  };

  const recentLoans = data?.recentLoans || [];
  const activePools = data?.activePools || [];

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
            <p className="text-destructive">Failed to load dashboard data. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8 pb-24">
      {/* Coverflow Carousel */}
      <div className="animate-fade-in-up">
        <CoverflowCarousel />
      </div>

      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of platform performance and key metrics
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value Locked</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(dashboardStats.totalValueLocked / 1000000).toFixed(2)}M USDC
            </div>
            <div className="flex items-center text-xs text-green-600 mt-1">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              {dashboardStats.tvlChange}% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Loans</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.totalLoans}</div>
            <div className="flex items-center text-xs text-green-600 mt-1">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              {dashboardStats.loansChange}% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Investors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.activeInvestors}</div>
            <div className="flex items-center text-xs text-green-600 mt-1">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              {dashboardStats.investorsChange}% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardStats.platformRevenue.toLocaleString()} USDC
            </div>
            <div className="flex items-center text-xs text-green-600 mt-1">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              {dashboardStats.revenueChange}% from last month
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Loan Applications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Loan Applications</CardTitle>
                <CardDescription>Latest loan requests requiring review</CardDescription>
              </div>
              <Link href="/admin/borrowers">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLoans.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No loan applications yet</p>
              ) : (
                recentLoans.map((loan: any) => {
                  const status = statusConfig[loan.status as keyof typeof statusConfig] || statusConfig.pending;
                  const StatusIcon = status.icon;
                  return (
                    <div key={loan.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm font-semibold">{loan.borrower}</p>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                            <StatusIcon className="h-3 w-3 inline mr-1" />
                            {status.label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{loan.businessName || 'Unknown Business'}</p>
                        <p className="text-xs text-muted-foreground">{loan.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{(loan.amount || 0).toLocaleString()} USDC</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active Pools Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Active Pools</CardTitle>
                <CardDescription>Current pool performance metrics</CardDescription>
              </div>
              <Link href="/admin/pools">
                <Button variant="outline" size="sm">
                  Manage Pools
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activePools.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No active pools yet</p>
              ) : (
                activePools.map((pool: any) => (
                  <Link key={pool.id} href={`/admin/pools/${pool.id}`}>
                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Waves className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{pool.name}</p>
                          <p className="text-xs text-muted-foreground">{pool.investors} investors</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{pool.tvl >= 1000000 ? (pool.tvl / 1000000).toFixed(1) + 'M' : (pool.tvl / 1000).toFixed(0) + 'K'} USDC</p>
                        <p className="text-xs text-green-600">{pool.apy?.toFixed(1) || 'N/A'}% APY</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/admin/pools/create">
              <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                <Waves className="h-6 w-6" />
                <span>Create New Pool</span>
              </Button>
            </Link>
            <Link href="/admin/pools/analytics">
              <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                <TrendingUp className="h-6 w-6" />
                <span>View Analytics</span>
              </Button>
            </Link>
            <Link href="/admin/explores">
              <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
                <Users className="h-6 w-6" />
                <span>Manage Investors</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
