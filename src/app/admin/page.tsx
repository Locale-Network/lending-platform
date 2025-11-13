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
} from 'lucide-react';
import Link from 'next/link';

// Mock dashboard data
const dashboardStats = {
  totalValueLocked: 5830000,
  tvlChange: 12.5,
  totalLoans: 234,
  loansChange: 8.3,
  activeInvestors: 156,
  investorsChange: 5.2,
  platformRevenue: 125340,
  revenueChange: 15.8,
};

const recentLoans = [
  {
    id: '1',
    borrower: '0x1234...5678',
    amount: 50000,
    pool: 'Small Business Growth',
    status: 'pending',
    date: '2 hours ago',
  },
  {
    id: '2',
    borrower: '0xabcd...efgh',
    amount: 75000,
    pool: 'Real Estate Ventures',
    status: 'approved',
    date: '5 hours ago',
  },
  {
    id: '3',
    borrower: '0x9876...5432',
    amount: 25000,
    pool: 'Working Capital',
    status: 'active',
    date: '1 day ago',
  },
];

const activePools = [
  { name: 'Small Business Growth Pool', tvl: 1250000, investors: 47, apy: 12.5 },
  { name: 'Real Estate Ventures', tvl: 2800000, investors: 89, apy: 10.8 },
  { name: 'Working Capital Pool', tvl: 680000, investors: 32, apy: 14.2 },
  { name: 'Equipment Financing', tvl: 1100000, investors: 28, apy: 9.5 },
];

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
  active: { label: 'Active', icon: Activity, color: 'bg-blue-100 text-blue-800' },
  rejected: { label: 'Rejected', icon: AlertCircle, color: 'bg-red-100 text-red-800' },
};

export default function AdminDashboard() {
  return (
    <div className="space-y-8 p-8 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
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
              ${(dashboardStats.totalValueLocked / 1000000).toFixed(2)}M
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
              ${dashboardStats.platformRevenue.toLocaleString()}
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
              <Link href="/admin/loans">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLoans.map(loan => {
                const status = statusConfig[loan.status as keyof typeof statusConfig];
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
                      <p className="text-sm text-muted-foreground">{loan.pool}</p>
                      <p className="text-xs text-muted-foreground">{loan.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${loan.amount.toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
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
              {activePools.map((pool, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
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
                    <p className="font-semibold text-sm">${(pool.tvl / 1000000).toFixed(1)}M</p>
                    <p className="text-xs text-green-600">{pool.apy}% APY</p>
                  </div>
                </div>
              ))}
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
