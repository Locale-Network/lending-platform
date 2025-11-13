'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Percent, Users, Activity, Target, Award } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function AnalyticsPage() {
  // Fetch pools data for analytics
  const { data: pools, isLoading } = useSWR('/api/pools/public', fetcher);

  return (
    <div className="space-y-8 p-8 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics & Insights</h1>
        <p className="text-muted-foreground mt-2">
          Platform-wide metrics and investment trends
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Value Locked"
          value="$5.83M"
          change="+12.3%"
          trend="up"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          title="Average APY"
          value="11.8%"
          change="+0.5%"
          trend="up"
          icon={<Percent className="h-4 w-4" />}
        />
        <MetricCard
          title="Active Investors"
          value="196"
          change="+8.3%"
          trend="up"
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          title="Active Pools"
          value={pools?.length || 0}
          change="0%"
          trend="neutral"
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pools">Pool Performance</TabsTrigger>
          <TabsTrigger value="trends">Market Trends</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <TVLGrowthChart />
            <APYDistributionChart pools={pools} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <InvestorGrowthChart />
            <PoolTypeBreakdownChart pools={pools} />
          </div>
        </TabsContent>

        <TabsContent value="pools" className="space-y-4">
          <PoolPerformanceTable pools={pools} />
          <div className="grid gap-4 md:grid-cols-2">
            <TopPerformingPools pools={pools} />
            <PoolLiquidityChart pools={pools} />
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <MarketTrendsChart />
          <div className="grid gap-4 md:grid-cols-2">
            <SeasonalTrendsCard />
            <RiskReturnChart pools={pools} />
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <InsightsCards />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  title,
  value,
  change,
  trend,
  icon,
}: {
  title: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center text-xs text-muted-foreground">
          {trend === 'up' && <TrendingUp className="mr-1 h-3 w-3 text-green-600" />}
          {trend === 'down' && <TrendingDown className="mr-1 h-3 w-3 text-red-600" />}
          <span className={trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : ''}>
            {change}
          </span>
          <span className="ml-1">from last month</span>
        </div>
      </CardContent>
    </Card>
  );
}

function TVLGrowthChart() {
  const data = [
    { month: 'Jan', tvl: 2100000 },
    { month: 'Feb', tvl: 2450000 },
    { month: 'Mar', tvl: 2890000 },
    { month: 'Apr', tvl: 3250000 },
    { month: 'May', tvl: 3800000 },
    { month: 'Jun', tvl: 4200000 },
    { month: 'Jul', tvl: 4650000 },
    { month: 'Aug', tvl: 5100000 },
    { month: 'Sep', tvl: 5550000 },
    { month: 'Oct', tvl: 5830000 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>TVL Growth</CardTitle>
        <CardDescription>Total Value Locked over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
              <Tooltip formatter={(value: number) => `$${(value / 1000000).toFixed(2)}M`} />
              <Area type="monotone" dataKey="tvl" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function APYDistributionChart({ pools }: { pools: any[] }) {
  if (!pools || pools.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>APY Distribution</CardTitle>
          <CardDescription>Distribution of pool APY rates</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const apyRanges = [
    { range: '0-5%', count: 0 },
    { range: '5-10%', count: 0 },
    { range: '10-15%', count: 0 },
    { range: '15-20%', count: 0 },
    { range: '20%+', count: 0 },
  ];

  pools.forEach(pool => {
    const apy = pool.annualizedReturn || 0;
    if (apy < 5) apyRanges[0].count++;
    else if (apy < 10) apyRanges[1].count++;
    else if (apy < 15) apyRanges[2].count++;
    else if (apy < 20) apyRanges[3].count++;
    else apyRanges[4].count++;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>APY Distribution</CardTitle>
        <CardDescription>Distribution of pool APY rates</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={apyRanges}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function InvestorGrowthChart() {
  const data = [
    { month: 'Jan', investors: 98 },
    { month: 'Feb', investors: 112 },
    { month: 'Mar', investors: 128 },
    { month: 'Apr', investors: 145 },
    { month: 'May', investors: 163 },
    { month: 'Jun', investors: 172 },
    { month: 'Jul', investors: 181 },
    { month: 'Aug', investors: 188 },
    { month: 'Sep', investors: 192 },
    { month: 'Oct', investors: 196 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Investor Growth</CardTitle>
        <CardDescription>Active investor count over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="investors" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function PoolTypeBreakdownChart({ pools }: { pools: any[] }) {
  if (!pools || pools.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pool Type Breakdown</CardTitle>
          <CardDescription>Distribution by pool type</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const typeCounts: Record<string, number> = {};
  pools.forEach(pool => {
    const type = pool.poolType || 'Unknown';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });

  const data = Object.entries(typeCounts).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value,
  }));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pool Type Breakdown</CardTitle>
        <CardDescription>Distribution by pool type</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => entry.name}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function PoolPerformanceTable({ pools }: { pools: any[] }) {
  if (!pools || pools.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pool Performance</CardTitle>
          <CardDescription>Detailed performance metrics for all pools</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pool Performance</CardTitle>
        <CardDescription>Detailed performance metrics for all pools</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Pool Name</th>
                <th className="text-right p-2">APY</th>
                <th className="text-right p-2">TVL</th>
                <th className="text-right p-2">Investors</th>
                <th className="text-right p-2">Liquidity</th>
              </tr>
            </thead>
            <tbody>
              {pools.slice(0, 10).map((pool) => (
                <tr key={pool.id} className="border-b hover:bg-muted/50">
                  <td className="p-2">{pool.name}</td>
                  <td className="text-right p-2 font-medium text-green-600">
                    {pool.annualizedReturn?.toFixed(1)}%
                  </td>
                  <td className="text-right p-2">
                    ${(pool.totalStaked / 1000000).toFixed(2)}M
                  </td>
                  <td className="text-right p-2">{pool.totalInvestors}</td>
                  <td className="text-right p-2">
                    ${(pool.availableLiquidity / 1000).toFixed(0)}K
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function TopPerformingPools({ pools }: { pools: any[] }) {
  if (!pools || pools.length === 0) return null;

  const topPools = [...pools]
    .sort((a, b) => (b.annualizedReturn || 0) - (a.annualizedReturn || 0))
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Performing Pools</CardTitle>
        <CardDescription>Highest APY pools</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topPools.map((pool, index) => (
            <div key={pool.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="outline">{index + 1}</Badge>
                <div>
                  <p className="font-medium">{pool.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {pool.totalInvestors} investors
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-600">{pool.annualizedReturn?.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">APY</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PoolLiquidityChart({ pools }: { pools: any[] }) {
  if (!pools || pools.length === 0) return null;

  const data = pools.slice(0, 8).map(pool => ({
    name: pool.name.split(' ').slice(0, 2).join(' '),
    liquidity: pool.availableLiquidity,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pool Liquidity</CardTitle>
        <CardDescription>Available liquidity by pool</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
              <YAxis dataKey="name" type="category" width={100} />
              <Tooltip formatter={(value: number) => `$${(value / 1000).toFixed(0)}K`} />
              <Bar dataKey="liquidity" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function MarketTrendsChart() {
  const data = [
    { month: 'Jan', avgApy: 11.2, tvl: 2100000 },
    { month: 'Feb', avgApy: 11.5, tvl: 2450000 },
    { month: 'Mar', avgApy: 11.4, tvl: 2890000 },
    { month: 'Apr', avgApy: 11.7, tvl: 3250000 },
    { month: 'May', avgApy: 11.6, tvl: 3800000 },
    { month: 'Jun', avgApy: 11.9, tvl: 4200000 },
    { month: 'Jul', avgApy: 11.8, tvl: 4650000 },
    { month: 'Aug', avgApy: 12.0, tvl: 5100000 },
    { month: 'Sep', avgApy: 11.9, tvl: 5550000 },
    { month: 'Oct', avgApy: 11.8, tvl: 5830000 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Trends</CardTitle>
        <CardDescription>Average APY and TVL trends over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" tickFormatter={(value) => `${value}%`} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="avgApy" stroke="#10b981" strokeWidth={2} name="Avg APY (%)" />
              <Line yAxisId="right" type="monotone" dataKey="tvl" stroke="#3b82f6" strokeWidth={2} name="TVL ($)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function SeasonalTrendsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seasonal Insights</CardTitle>
        <CardDescription>Quarterly performance trends</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-l-4 border-green-500 pl-4">
          <p className="font-semibold">Q4 2024: Strong Growth</p>
          <p className="text-sm text-muted-foreground">
            TVL increased by 18.5% with average APY holding steady at 11.8%
          </p>
        </div>
        <div className="border-l-4 border-blue-500 pl-4">
          <p className="font-semibold">Popular Pool Types</p>
          <p className="text-sm text-muted-foreground">
            Real Estate and Small Business pools show highest investor interest
          </p>
        </div>
        <div className="border-l-4 border-amber-500 pl-4">
          <p className="font-semibold">Liquidity Trend</p>
          <p className="text-sm text-muted-foreground">
            Average pool liquidity increased by 12% month-over-month
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function RiskReturnChart({ pools }: { pools: any[] }) {
  if (!pools || pools.length === 0) return null;

  const data = pools.map(pool => ({
    name: pool.name,
    apy: pool.annualizedReturn || 0,
    risk: pool.riskLevel === 'High' ? 3 : pool.riskLevel === 'Medium' ? 2 : 1,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk vs Return</CardTitle>
        <CardDescription>APY relative to risk level</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="apy" fill="#3b82f6" name="APY %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightsCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-green-600" />
            <CardTitle>Investment Opportunity</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">
            <strong>Real Estate Ventures</strong> pool currently offers the best risk-adjusted returns with a
            10.8% APY and low risk rating.
          </p>
          <Badge className="bg-green-100 text-green-800">Recommended</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-600" />
            <CardTitle>Platform Growth</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            The platform has grown by <strong>+42%</strong> in TVL year-over-year, with investor
            count increasing by <strong>+28%</strong>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <CardTitle>Market Outlook</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Lending pools are maintaining stable APY rates while liquidity continues to improve
            across all pool types.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-purple-600" />
            <CardTitle>Diversification Tip</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Consider spreading investments across 3-5 different pool types to optimize
            risk-adjusted returns.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
