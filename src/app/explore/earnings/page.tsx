import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, DollarSign, Calendar, PieChart } from 'lucide-react';
import { ApplyFundingButton } from '@/components/ui/apply-funding-button';

export default function EarningsPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Earnings</h1>
        <p className="text-muted-foreground">Track your investment returns and earnings history</p>
      </div>

      <Suspense fallback={<EarningsStatsSkeleton />}>
        <EarningsStats />
      </Suspense>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Earnings</TabsTrigger>
          <TabsTrigger value="monthly">This Month</TabsTrigger>
          <TabsTrigger value="yearly">This Year</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Suspense fallback={<EarningsListSkeleton />}>
            <AllEarnings />
          </Suspense>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <Suspense fallback={<EarningsListSkeleton />}>
            <MonthlyEarnings />
          </Suspense>
        </TabsContent>

        <TabsContent value="yearly" className="space-y-4">
          <Suspense fallback={<EarningsListSkeleton />}>
            <YearlyEarnings />
          </Suspense>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Earnings by Pool</CardTitle>
          <CardDescription>Breakdown of earnings across your investment pools</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<EarningsByPoolSkeleton />}>
            <EarningsByPool />
          </Suspense>
        </CardContent>
      </Card>

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

function EarningsStats() {
  // TODO: Fetch real data from database
  const stats = {
    lifetimeEarnings: 2500,
    monthlyEarnings: 215,
    yearlyEarnings: 2350,
    avgMonthlyReturn: 4.3,
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Lifetime Earnings</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${stats.lifetimeEarnings.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Total earned to date</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Month</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${stats.monthlyEarnings.toLocaleString()}</div>
          <p className="text-xs text-green-600">+{stats.avgMonthlyReturn}% from last month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Year</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${stats.yearlyEarnings.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Year-to-date earnings</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Monthly</CardTitle>
          <PieChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${(stats.yearlyEarnings / 12).toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Average per month</p>
        </CardContent>
      </Card>
    </div>
  );
}

function AllEarnings() {
  // TODO: Fetch real data from database
  const earnings = [
    {
      id: '1',
      date: '2024-01-15',
      poolName: 'Small Business Growth Pool',
      amount: 125.50,
      type: 'Interest Payment',
    },
    {
      id: '2',
      date: '2024-01-14',
      poolName: 'Real Estate Development',
      amount: 187.25,
      type: 'Interest Payment',
    },
    {
      id: '3',
      date: '2024-01-13',
      poolName: 'Consumer Credit Pool',
      amount: 312.75,
      type: 'Interest Payment',
    },
    {
      id: '4',
      date: '2024-01-10',
      poolName: 'Small Business Growth Pool',
      amount: 125.50,
      type: 'Interest Payment',
    },
    {
      id: '5',
      date: '2024-01-08',
      poolName: 'Real Estate Development',
      amount: 187.25,
      type: 'Interest Payment',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Earnings History</CardTitle>
        <CardDescription>All earnings from your investments</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {earnings.map((earning) => (
            <div key={earning.id} className="flex items-center justify-between border-b pb-4 last:border-0">
              <div className="space-y-1">
                <p className="font-medium">{earning.poolName}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{earning.type}</span>
                  <span>•</span>
                  <span>{new Date(earning.date).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-green-600">+${earning.amount.toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyEarnings() {
  // TODO: Fetch real data from database filtered by current month
  const earnings = [
    {
      id: '1',
      date: '2024-01-15',
      poolName: 'Small Business Growth Pool',
      amount: 125.50,
      type: 'Interest Payment',
    },
    {
      id: '2',
      date: '2024-01-14',
      poolName: 'Real Estate Development',
      amount: 187.25,
      type: 'Interest Payment',
    },
    {
      id: '3',
      date: '2024-01-13',
      poolName: 'Consumer Credit Pool',
      amount: 312.75,
      type: 'Interest Payment',
    },
  ];

  const total = earnings.reduce((sum, e) => sum + e.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>This Month's Earnings</CardTitle>
        <CardDescription>Earnings for January 2024 • Total: ${total.toFixed(2)}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {earnings.map((earning) => (
            <div key={earning.id} className="flex items-center justify-between border-b pb-4 last:border-0">
              <div className="space-y-1">
                <p className="font-medium">{earning.poolName}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{earning.type}</span>
                  <span>•</span>
                  <span>{new Date(earning.date).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-green-600">+${earning.amount.toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function YearlyEarnings() {
  // TODO: Fetch real data from database filtered by current year
  const monthlyBreakdown = [
    { month: 'January', amount: 625.50 },
    { month: 'December', amount: 587.25 },
    { month: 'November', amount: 612.75 },
    { month: 'October', amount: 598.40 },
    { month: 'September', amount: 621.30 },
  ];

  const total = monthlyBreakdown.reduce((sum, m) => sum + m.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>This Year's Earnings</CardTitle>
        <CardDescription>Earnings for 2024 • Total: ${total.toFixed(2)}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {monthlyBreakdown.map((item, index) => (
            <div key={index} className="flex items-center justify-between border-b pb-4 last:border-0">
              <div>
                <p className="font-medium">{item.month} 2024</p>
                <p className="text-sm text-muted-foreground">Monthly total</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-green-600">+${item.amount.toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EarningsByPool() {
  // TODO: Fetch real data from database
  const poolEarnings = [
    {
      poolName: 'Small Business Growth Pool',
      totalEarned: 500,
      percentage: 20,
      color: 'bg-blue-500',
    },
    {
      poolName: 'Real Estate Development',
      totalEarned: 750,
      percentage: 30,
      color: 'bg-green-500',
    },
    {
      poolName: 'Consumer Credit Pool',
      totalEarned: 1250,
      percentage: 50,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="space-y-4">
      {poolEarnings.map((pool) => (
        <div key={pool.poolName} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${pool.color}`} />
              <span className="font-medium">{pool.poolName}</span>
            </div>
            <div className="text-right">
              <p className="font-semibold">${pool.totalEarned.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">{pool.percentage}%</p>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full ${pool.color}`}
              style={{ width: `${pool.percentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function EarningsStatsSkeleton() {
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

function EarningsListSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between border-b pb-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EarningsByPoolSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-2 w-full" />
        </div>
      ))}
    </div>
  );
}
