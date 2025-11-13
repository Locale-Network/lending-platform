'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp,
  DollarSign,
  Users,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

// Mock analytics data
const analyticsData = {
  totalRevenue: 125340,
  revenueChange: 12.5,
  totalLoansIssued: 234,
  loansChange: 8.3,
  activeInvestors: 156,
  investorsChange: -2.1,
  averageReturn: 11.2,
  returnChange: 0.5,
};

const recentActivity = [
  {
    id: '1',
    type: 'investment',
    investor: '0x1234...5678',
    pool: 'Small Business Growth Pool',
    amount: 50000,
    timestamp: '2 hours ago',
  },
  {
    id: '2',
    type: 'loan',
    borrower: '0xabcd...efgh',
    pool: 'Real Estate Ventures',
    amount: 75000,
    timestamp: '5 hours ago',
  },
  {
    id: '3',
    type: 'repayment',
    borrower: '0x9876...5432',
    pool: 'Working Capital Pool',
    amount: 12500,
    timestamp: '1 day ago',
  },
  {
    id: '4',
    type: 'investment',
    investor: '0xfedc...ba98',
    pool: 'Small Business Growth Pool',
    amount: 25000,
    timestamp: '1 day ago',
  },
];

const poolPerformance = [
  { name: 'Small Business Growth Pool', apy: 12.5, tvl: 1250000, growth: 15.2 },
  { name: 'Real Estate Ventures', apy: 10.8, tvl: 2800000, growth: 8.7 },
  { name: 'Working Capital Pool', apy: 14.2, tvl: 680000, growth: 22.1 },
  { name: 'Equipment Financing', apy: 9.5, tvl: 1100000, growth: 5.4 },
];

export default function AnalyticsPage() {
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
            <div className="text-2xl font-bold">${analyticsData.totalRevenue.toLocaleString()}</div>
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
            {poolPerformance.map((pool, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <p className="font-semibold">{pool.name}</p>
                  <p className="text-sm text-muted-foreground">
                    TVL: ${(pool.tvl / 1000000).toFixed(1)}M
                  </p>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">APY</p>
                    <p className="font-semibold text-green-600">{pool.apy}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">30d Growth</p>
                    <div className="flex items-center text-green-600">
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                      <p className="font-semibold">{pool.growth}%</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
            {recentActivity.map(activity => (
              <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        activity.type === 'investment'
                          ? 'bg-blue-100 text-blue-800'
                          : activity.type === 'loan'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {activity.type.toUpperCase()}
                    </span>
                    <p className="font-medium">{activity.pool}</p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activity.type === 'investment' ? activity.investor : activity.borrower}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${activity.amount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
