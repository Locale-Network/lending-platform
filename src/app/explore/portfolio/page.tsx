'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, DollarSign, PieChart, Activity, Wallet, ArrowUpRight, ArrowDownLeft, Clock, ExternalLink, RefreshCw, Plus, ArrowRight, Settings, Loader2 } from 'lucide-react';
import { HoldConfirmModal } from '@/components/ui/hold-confirm-modal';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { Progress } from '@/components/ui/progress';
import { ApplyFundingButton } from '@/components/ui/apply-funding-button';
import { PortfolioAllocationChart } from '@/components/portfolio/portfolio-allocation-chart';
import { PortfolioPerformanceChart } from '@/components/portfolio/portfolio-performance-chart';
import { BlockchainTransfers } from '@/components/blockchain-transfers';
import { PoolActivityFeed } from '@/components/pool-activity-feed';
import { useRealtimeTransactions, StakeTransaction } from '@/hooks/use-realtime-transactions';
import { useToast } from '@/hooks/use-toast';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { useUserStake, useCompleteUnstake } from '@/hooks/useStakingPool';
import useSWR from 'swr';
import Link from 'next/link';
import { getExplorerUrl } from '@/lib/explorer';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function PortfolioPage() {
  const { address } = useWalletAuth();
  // Only fetch portfolio data when we have a wallet address
  const { data: portfolioData, error: portfolioError, isLoading: portfolioLoading } = useSWR(
    address ? `/api/portfolio/stakes?address=${address}` : null,
    fetcher
  );
  const [transactions, setTransactions] = useState<StakeTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const { toast } = useToast();

  // Get pending withdrawal state directly from the blockchain contract
  // Derive pool slug from portfolio data instead of hardcoding
  const activePoolSlug = portfolioData?.stakes?.[0]?.pool?.slug as string | undefined;
  const { stake: userStakeData, refetch: refetchUserStake } = useUserStake(activePoolSlug);

  // Complete unstake hook for withdrawing after cooldown
  const { completeUnstake, isPending: isCompletingUnstake, isConfirmed: unstakeConfirmed, error: unstakeError } = useCompleteUnstake();

  const fetchTransactions = useCallback(async (showRefreshToast = false) => {
    if (!address) {
      setTransactionsLoading(false);
      return;
    }

    try {
      setRefreshing(showRefreshToast);
      const response = await fetch(`/api/stake-transactions?address=${address}`);

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      setTransactions(data.transactions || []);

      // Also refresh pending withdrawal data from blockchain
      await refetchUserStake();

      if (showRefreshToast) {
        toast({
          title: 'Transactions Updated',
          description: 'Your transaction history has been refreshed.',
        });
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setTransactionsLoading(false);
      setRefreshing(false);
    }
  }, [toast, address, refetchUserStake]);

  useEffect(() => {
    if (address) {
      fetchTransactions();
    }
  }, [fetchTransactions, address]);

  // Handle complete unstake withdrawal
  const handleCompleteUnstake = useCallback(async () => {
    try {
      await completeUnstake('real-estate-bridge');
      toast({
        title: 'Withdrawal Complete',
        description: 'Your funds have been withdrawn successfully.',
      });
      // Refresh data
      await refetchUserStake();
      fetchTransactions(false);
    } catch (err) {
      toast({
        title: 'Withdrawal Failed',
        description: err instanceof Error ? err.message : 'Failed to complete withdrawal',
        variant: 'destructive',
      });
    }
  }, [completeUnstake, toast, refetchUserStake, fetchTransactions]);

  // Show toast on unstake confirmation
  useEffect(() => {
    if (unstakeConfirmed) {
      refetchUserStake();
    }
  }, [unstakeConfirmed, refetchUserStake]);

  // Subscribe to realtime updates
  const { isSubscribed } = useRealtimeTransactions(
    // On transaction update
    (updatedTx) => {
      setTransactions((prev) =>
        prev.map((tx) => (tx.id === updatedTx.id ? { ...tx, ...updatedTx } : tx))
      );
      toast({
        title: 'Transaction Updated',
        description: `Transaction status changed to ${updatedTx.status}`,
      });
    },
    // On new transaction insert
    (newTx) => {
      setTransactions((prev) => [newTx, ...prev]);
      toast({
        title: 'New Transaction',
        description: `${newTx.type} transaction created`,
      });
    },
    // On transaction delete
    (deletedTx) => {
      setTransactions((prev) => prev.filter((tx) => tx.id !== deletedTx.id));
    }
  );

  // Calculate transaction stats (using lowercase types from staking_events)
  // Pending withdrawal amount comes directly from the blockchain contract
  const pendingUnstakeAmount = userStakeData?.pendingUnstake
    ? Number(userStakeData.pendingUnstake) / 1e6 // Convert from USDC decimals (6)
    : 0;
  const canWithdrawAt = userStakeData?.canWithdrawAt
    ? new Date(Number(userStakeData.canWithdrawAt) * 1000) // Convert from Unix timestamp
    : null;

  const transactionStats = {
    totalStaked: transactions
      .filter(tx => tx.type === 'stake' && tx.status === 'completed')
      .reduce((sum, tx) => sum + tx.amount, 0),
    totalWithdrawn: transactions
      .filter(tx => tx.type === 'unstake' && tx.status === 'completed')
      .reduce((sum, tx) => sum + tx.amount, 0),
    totalInterestClaimed: 0, // Interest claims are not tracked in staking_events
    pendingUnstakeAmount, // From blockchain contract
    canWithdrawAt, // From blockchain contract
  };

  // Calculate earnings from portfolio data
  const stakes = portfolioData?.stakes || [];
  const summary = portfolioData?.summary || {
    totalInvested: 0,
    totalValue: 0,
    totalRewards: 0,
    activeInvestments: 0,
    avgReturn: 0,
  };

  // Calculate earnings by pool
  const earningsByPool = stakes.map((stake: any) => ({
    poolName: stake.pool?.name || 'Unknown Pool',
    poolSlug: stake.pool?.slug,
    totalEarned: stake.rewards || 0,
    invested: stake.amount || 0,
  }));

  const totalEarnings = earningsByPool.reduce((sum: number, pool: any) => sum + pool.totalEarned, 0);

  if (portfolioLoading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8 space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Portfolio</h1>
          <p className="text-muted-foreground">Track your investments, earnings, and transactions</p>
        </div>
        <PortfolioStatsSkeleton />
        <InvestmentListSkeleton />
      </div>
    );
  }

  if (portfolioError) {
    return (
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8 space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Portfolio</h1>
          <p className="text-muted-foreground">Track your investments, earnings, and transactions</p>
        </div>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load portfolio data. Please try again later.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const gainPercentage = summary.totalInvested > 0
    ? ((summary.totalValue - summary.totalInvested) / summary.totalInvested * 100).toFixed(2)
    : 0;

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8 space-y-6 sm:space-y-8">
      {/* Header with refresh and live indicator */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">My Portfolio</h1>
          <p className="text-muted-foreground">Track your investments, earnings, and transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTransactions(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Portfolio Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-fade-in-stagger">
        <Card variant="elevated" className="bg-gradient-subtle">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invested</CardTitle>
            <div className="p-2 rounded-full bg-blue-500/10">
              <DollarSign className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{summary.totalInvested.toLocaleString()} <span className="text-lg font-medium text-muted-foreground">USDC</span></div>
            <p className="text-xs text-muted-foreground mt-1">Across {summary.activeInvestments} pools</p>
          </CardContent>
        </Card>

        <Card variant="elevated" className="bg-gradient-subtle">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
            <div className="p-2 rounded-full bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{summary.totalValue.toLocaleString()} <span className="text-lg font-medium text-muted-foreground">USDC</span></div>
            <p className={`text-xs mt-1 ${Number(gainPercentage) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {Number(gainPercentage) >= 0 ? '+' : ''}{gainPercentage}% all time
            </p>
          </CardContent>
        </Card>

        <Card variant="elevated" className="bg-gradient-subtle">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <div className="p-2 rounded-full bg-green-500/10">
              <Activity className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-green-600">+{summary.totalRewards.toLocaleString()} <span className="text-lg font-medium">USDC</span></div>
            <p className="text-xs text-muted-foreground mt-1">Lifetime earnings</p>
          </CardContent>
        </Card>

        <Card variant="elevated" className="bg-gradient-subtle">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Return</CardTitle>
            <div className="p-2 rounded-full bg-purple-500/10">
              <PieChart className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{summary.avgReturn}<span className="text-lg font-medium text-muted-foreground">%</span></div>
            <p className="text-xs text-muted-foreground mt-1">Annual percentage</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Visualizations */}
      {stakes && stakes.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <PortfolioPerformanceChart stakes={stakes} />
          <PortfolioAllocationChart stakes={stakes} />
        </div>
      )}

      {/* Quick Actions */}
      <Card variant="elevated" className="animate-fade-in-up">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Manage your investments</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/explore/pools">
            <Button size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Invest in New Pool
            </Button>
          </Link>
          <Link href="/explore/settings">
            <Button size="lg" variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Change Settings
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="investments" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="investments">Investments</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Investments Tab */}
        <TabsContent value="investments" className="space-y-4">
          <Tabs defaultValue="active" className="w-full">
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              <ActiveInvestments stakes={stakes} />
            </TabsContent>

            <TabsContent value="all" className="space-y-4">
              <AllInvestments stakes={stakes} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Earnings Tab */}
        <TabsContent value="earnings" className="space-y-4">
          {/* Earnings Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{totalEarnings.toLocaleString()} USDC</div>
                <p className="text-xs text-muted-foreground">Lifetime earnings</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rewards Claimed</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{transactionStats.totalInterestClaimed.toLocaleString()} USDC</div>
                <p className="text-xs text-muted-foreground">Total claimed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unclaimed</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.max(0, totalEarnings - transactionStats.totalInterestClaimed).toLocaleString()} USDC</div>
                <p className="text-xs text-muted-foreground">Available to claim</p>
              </CardContent>
            </Card>
          </div>

          {/* Earnings by Pool */}
          <Card>
            <CardHeader>
              <CardTitle>Earnings by Pool</CardTitle>
              <CardDescription>Breakdown of earnings across your investment pools</CardDescription>
            </CardHeader>
            <CardContent>
              {earningsByPool.length > 0 ? (
                <div className="space-y-4">
                  {earningsByPool.map((pool: any, index: number) => {
                    const percentage = totalEarnings > 0 ? (pool.totalEarned / totalEarnings * 100) : 0;
                    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
                    const color = colors[index % colors.length];

                    return (
                      <div key={pool.poolSlug || index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`h-3 w-3 rounded-full ${color}`} />
                            {pool.poolSlug ? (
                              <Link href={`/explore/pools/${pool.poolSlug}`} className="font-medium hover:underline">
                                {pool.poolName}
                              </Link>
                            ) : (
                              <span className="font-medium">{pool.poolName}</span>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-600">+{pool.totalEarned.toLocaleString()} USDC</p>
                            <p className="text-sm text-muted-foreground">{percentage.toFixed(1)}%</p>
                          </div>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full ${color}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No earnings yet. Start investing to earn rewards!</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          {/* Transaction Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Staked</CardTitle>
                <ArrowUpRight className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{transactionStats.totalStaked.toLocaleString()} USDC</div>
                <p className="text-xs text-muted-foreground">All-time deposits</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Unstaked</CardTitle>
                <ArrowDownLeft className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{transactionStats.totalWithdrawn.toLocaleString()} USDC</div>
                <p className="text-xs text-muted-foreground">All-time unstakes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rewards Claimed</CardTitle>
                <DollarSign className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{transactionStats.totalInterestClaimed.toLocaleString()} USDC</div>
                <p className="text-xs text-muted-foreground">Claimed earnings</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Withdrawal</CardTitle>
                <Clock className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {transactionStats.pendingUnstakeAmount > 0
                    ? `${transactionStats.pendingUnstakeAmount.toLocaleString()} USDC`
                    : '0 USDC'}
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {transactionStats.pendingUnstakeAmount > 0 && transactionStats.canWithdrawAt
                    ? transactionStats.canWithdrawAt > new Date()
                      ? `Unlocks ${transactionStats.canWithdrawAt.toLocaleDateString()}`
                      : 'Ready to withdraw'
                    : 'No pending withdrawals'}
                </p>
                {transactionStats.pendingUnstakeAmount > 0 &&
                  transactionStats.canWithdrawAt &&
                  transactionStats.canWithdrawAt <= new Date() && (
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                      onClick={() => setShowWithdrawModal(true)}
                      disabled={isCompletingUnstake}
                    >
                      {isCompletingUnstake ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Withdraw Funds'
                      )}
                    </Button>
                  )}
              </CardContent>
            </Card>
          </div>

          {/* Transaction Filters */}
          <Tabs defaultValue="all-tx" className="w-full">
            <TabsList>
              <TabsTrigger value="all-tx">All</TabsTrigger>
              <TabsTrigger value="stakes">Stakes</TabsTrigger>
              <TabsTrigger value="unstakes">Unstakes</TabsTrigger>
              <TabsTrigger value="rewards">Rewards</TabsTrigger>
            </TabsList>

            <TabsContent value="all-tx">
              {transactionsLoading ? (
                <TransactionListSkeleton />
              ) : (
                <TransactionList transactions={transactions} />
              )}
            </TabsContent>

            <TabsContent value="stakes">
              {transactionsLoading ? (
                <TransactionListSkeleton />
              ) : (
                <TransactionList transactions={transactions.filter(tx => tx.type === 'stake')} />
              )}
            </TabsContent>

            <TabsContent value="unstakes">
              {transactionsLoading ? (
                <TransactionListSkeleton />
              ) : (
                <TransactionList transactions={transactions.filter(tx => tx.type === 'unstake' || tx.type === 'unstake_request')} />
              )}
            </TabsContent>

            <TabsContent value="rewards">
              {transactionsLoading ? (
                <TransactionListSkeleton />
              ) : (
                <TransactionList transactions={[]} emptyMessage="Reward claims are tracked on-chain" />
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Activity Tab - Shows all pool activity (all investors) */}
        <TabsContent value="activity" className="space-y-4">
          <PoolActivityFeed />
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

      {/* Withdraw Confirmation Modal */}
      <HoldConfirmModal
        open={showWithdrawModal}
        onOpenChange={setShowWithdrawModal}
        onConfirm={handleCompleteUnstake}
        title="Withdraw Funds"
        description="Your cooldown period is complete. Confirm to withdraw your funds to your wallet."
        confirmText="Hold to Withdraw"
        variant="success"
        duration={2000}
        loading={isCompletingUnstake}
        details={
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-medium">{transactionStats.pendingUnstakeAmount?.toLocaleString() || 0} USDC</span>
            </div>
          </div>
        }
      />
    </div>
  );
}

function ActiveInvestments({ stakes }: { stakes: any[] }) {
  if (!stakes || stakes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No active investments yet</p>
        <Link href="/explore/pools">
          <Button variant="outline">Explore Pools</Button>
        </Link>
      </div>
    );
  }

  const activeStakes = stakes.filter(stake => stake.pool?.status === 'ACTIVE');

  if (activeStakes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No active investments</p>
        <Link href="/explore/pools">
          <Button variant="outline">Explore Pools</Button>
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
                <Link href={`/explore/pools/${stake.pool?.slug}`}>
                  <CardTitle className="hover:underline">{stake.pool?.name || 'Unknown Pool'}</CardTitle>
                </Link>
                <CardDescription>APY: {stake.pool?.annualizedReturn || 0}%</CardDescription>
              </div>
              <Badge variant="default" className="bg-green-600">
                {stake.pool?.status || 'Active'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Invested</p>
                <p className="text-lg font-semibold">{stake.amount.toLocaleString()} USDC</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Value</p>
                <p className="text-lg font-semibold">{stake.currentValue.toLocaleString()} USDC</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Earned</p>
                <p className="text-lg font-semibold text-green-600">+{stake.rewards.toLocaleString()} USDC</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AllInvestments({ stakes }: { stakes: any[] }) {
  if (!stakes || stakes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No investments yet</p>
        <Link href="/explore/pools">
          <Button variant="outline">Explore Pools</Button>
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
                <Link href={`/explore/pools/${stake.pool?.slug}`}>
                  <CardTitle className="hover:underline">{stake.pool?.name || 'Unknown Pool'}</CardTitle>
                </Link>
                <CardDescription>APY: {stake.pool?.annualizedReturn || 0}%</CardDescription>
              </div>
              <Badge variant={stake.pool?.status === 'ACTIVE' ? 'default' : 'secondary'}>
                {stake.pool?.status || 'Unknown'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Invested</p>
                <p className="text-lg font-semibold">{stake.amount.toLocaleString()} USDC</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Value</p>
                <p className="text-lg font-semibold">{stake.currentValue.toLocaleString()} USDC</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Earned</p>
                <p className="text-lg font-semibold text-green-600">+{stake.rewards.toLocaleString()} USDC</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TransactionList({ transactions, emptyMessage }: { transactions: StakeTransaction[], emptyMessage?: string }) {
  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground py-8">{emptyMessage || 'No transactions yet'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>All your investment transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.map((tx) => (
            <TransactionRow key={tx.id} transaction={tx} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionRow({ transaction }: { transaction: StakeTransaction }) {
  const getTypeIcon = () => {
    switch (transaction.type) {
      case 'stake':
        return <ArrowUpRight className="h-4 w-4 text-green-600" />;
      case 'unstake':
        return <ArrowDownLeft className="h-4 w-4 text-orange-600" />;
      case 'unstake_request':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTypeLabel = () => {
    const labels: Record<string, string> = {
      stake: 'Stake',
      unstake: 'Unstake Completed',
      unstake_request: 'Unstake Requested',
    };
    return labels[transaction.type] || transaction.type;
  };

  const getStatusBadge = () => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      pending: 'secondary',
    };

    const displayStatus = transaction.status === 'pending' ? 'Pending Unlock' : 'Completed';

    return (
      <Badge variant={variants[transaction.status] || 'outline'}>
        {displayStatus}
      </Badge>
    );
  };

  const getAmountColor = () => {
    if (transaction.type === 'unstake' || transaction.type === 'unstake_request') return 'text-orange-600';
    if (transaction.type === 'stake') return 'text-green-600';
    return 'text-blue-600';
  };

  const getAmountPrefix = () => {
    if (transaction.type === 'unstake' || transaction.type === 'unstake_request') return '-';
    return '+';
  };

  const formatTxHash = (hash: string | null) => {
    if (!hash) return null;
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  // Format unlock time for pending unstake requests
  const formatUnlockTime = () => {
    if (!transaction.unlock_time || transaction.type !== 'unstake_request') return null;
    const unlockDate = new Date(transaction.unlock_time);
    const now = new Date();
    if (unlockDate <= now) {
      return 'Ready to complete';
    }
    const diffMs = unlockDate.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) {
      return `Unlocks in ${diffDays}d ${diffHours % 24}h`;
    }
    return `Unlocks in ${diffHours}h`;
  };

  return (
    <div className="flex items-center justify-between border-b pb-4 last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          {getTypeIcon()}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {transaction.pool ? (
              <Link
                href={`/explore/pools/${transaction.pool.slug}`}
                className="font-medium hover:underline"
              >
                {transaction.pool.name}
              </Link>
            ) : (
              <span className="font-medium">Pool {transaction.pool_id.slice(0, 8)}...</span>
            )}
            {getStatusBadge()}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{getTypeLabel()}</span>
            <span>•</span>
            <span>{new Date(transaction.created_at).toLocaleString()}</span>
            {transaction.transaction_hash && (
              <>
                <span>•</span>
                <a
                  href={getExplorerUrl('tx', transaction.transaction_hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1"
                >
                  {formatTxHash(transaction.transaction_hash)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </>
            )}
          </div>
          {formatUnlockTime() && (
            <div className="text-xs text-yellow-600 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatUnlockTime()}
            </div>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className={`text-lg font-semibold ${getAmountColor()}`}>
          {getAmountPrefix()}{transaction.amount.toLocaleString()} USDC
        </p>
        {transaction.pool && transaction.pool.annualized_return && (
          <p className="text-xs text-muted-foreground">
            APY: {transaction.pool.annualized_return}%
          </p>
        )}
      </div>
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

function TransactionListSkeleton() {
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
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
