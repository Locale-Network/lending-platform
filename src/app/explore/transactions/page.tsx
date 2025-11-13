'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, ArrowDownLeft, DollarSign, Clock, ExternalLink, RefreshCw, Radio } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRealtimeTransactions, StakeTransaction as BaseStakeTransaction } from '@/hooks/use-realtime-transactions';
import { BlockchainTransfers } from '@/components/blockchain-transfers';

type StakeTransaction = BaseStakeTransaction & {
  pool?: {
    id: string;
    name: string;
    slug: string;
    annualized_return: number;
  };
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<StakeTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchTransactions = async (showRefreshToast = false) => {
    try {
      setRefreshing(showRefreshToast);
      const response = await fetch('/api/stake-transactions');

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      setTransactions(data.transactions);

      if (showRefreshToast) {
        toast({
          title: 'Transactions Updated',
          description: 'Your transaction history has been refreshed.',
        });
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch transactions. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

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

  // Calculate stats from transactions
  const stats = {
    totalStaked: transactions
      .filter(tx => tx.type === 'STAKE' && tx.status === 'COMPLETED')
      .reduce((sum, tx) => sum + tx.amount, 0),
    totalWithdrawn: transactions
      .filter(tx => tx.type === 'UNSTAKE' && tx.status === 'COMPLETED')
      .reduce((sum, tx) => sum + tx.amount, 0),
    totalInterestClaimed: transactions
      .filter(tx => tx.type === 'CLAIM_REWARDS' && tx.status === 'COMPLETED')
      .reduce((sum, tx) => sum + tx.amount, 0),
    pendingTransactions: transactions.filter(tx => tx.status === 'PENDING').length,
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">View your complete transaction history</p>
        </div>
        <div className="flex items-center gap-3">
          {isSubscribed && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Radio className="h-4 w-4 text-green-600 animate-pulse" />
              <span>Live</span>
            </div>
          )}
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

      {loading ? (
        <TransactionStatsSkeleton />
      ) : (
        <TransactionStats stats={stats} />
      )}

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Transactions</TabsTrigger>
          <TabsTrigger value="stakes">Stakes</TabsTrigger>
          <TabsTrigger value="withdrawals">Unstakes</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="blockchain">Blockchain</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {loading ? (
            <TransactionListSkeleton />
          ) : (
            <AllTransactions transactions={transactions} />
          )}
        </TabsContent>

        <TabsContent value="stakes" className="space-y-4">
          {loading ? (
            <TransactionListSkeleton />
          ) : (
            <StakeTransactions transactions={transactions.filter(tx => tx.type === 'STAKE')} />
          )}
        </TabsContent>

        <TabsContent value="withdrawals" className="space-y-4">
          {loading ? (
            <TransactionListSkeleton />
          ) : (
            <WithdrawalTransactions transactions={transactions.filter(tx => tx.type === 'UNSTAKE')} />
          )}
        </TabsContent>

        <TabsContent value="rewards" className="space-y-4">
          {loading ? (
            <TransactionListSkeleton />
          ) : (
            <RewardTransactions transactions={transactions.filter(tx => tx.type === 'CLAIM_REWARDS')} />
          )}
        </TabsContent>

        <TabsContent value="blockchain" className="space-y-4">
          <BlockchainTransfers />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TransactionStats({
  stats
}: {
  stats: {
    totalStaked: number;
    totalWithdrawn: number;
    totalInterestClaimed: number;
    pendingTransactions: number;
  }
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Staked</CardTitle>
          <ArrowUpRight className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${stats.totalStaked.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">All-time deposits</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Unstaked</CardTitle>
          <ArrowDownLeft className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${stats.totalWithdrawn.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">All-time unstakes</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Rewards Claimed</CardTitle>
          <DollarSign className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${stats.totalInterestClaimed.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">Claimed earnings</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pendingTransactions}</div>
          <p className="text-xs text-muted-foreground">Processing</p>
        </CardContent>
      </Card>
    </div>
  );
}

function AllTransactions({ transactions }: { transactions: StakeTransaction[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>All your investment transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.length > 0 ? (
            transactions.map((tx) => <TransactionRow key={tx.id} transaction={tx} />)
          ) : (
            <p className="text-center text-muted-foreground py-8">No transactions yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StakeTransactions({ transactions }: { transactions: StakeTransaction[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stake Transactions</CardTitle>
        <CardDescription>Your deposit history</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.length > 0 ? (
            transactions.map((tx) => <TransactionRow key={tx.id} transaction={tx} />)
          ) : (
            <p className="text-center text-muted-foreground py-8">No stakes yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WithdrawalTransactions({ transactions }: { transactions: StakeTransaction[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Unstake Transactions</CardTitle>
        <CardDescription>Your unstake history</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.length > 0 ? (
            transactions.map((tx) => <TransactionRow key={tx.id} transaction={tx} />)
          ) : (
            <p className="text-center text-muted-foreground py-8">No unstakes yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RewardTransactions({ transactions }: { transactions: StakeTransaction[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reward Claims</CardTitle>
        <CardDescription>Your claimed rewards history</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.length > 0 ? (
            transactions.map((tx) => <TransactionRow key={tx.id} transaction={tx} />)
          ) : (
            <p className="text-center text-muted-foreground py-8">No rewards claimed yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionRow({ transaction }: { transaction: StakeTransaction }) {
  const getTypeIcon = () => {
    switch (transaction.type) {
      case 'STAKE':
        return <ArrowUpRight className="h-4 w-4 text-green-600" />;
      case 'UNSTAKE':
        return <ArrowDownLeft className="h-4 w-4 text-orange-600" />;
      case 'CLAIM_REWARDS':
        return <DollarSign className="h-4 w-4 text-blue-600" />;
      case 'POOL_DEPOSIT':
        return <ArrowUpRight className="h-4 w-4 text-purple-600" />;
      case 'POOL_WITHDRAWAL':
        return <ArrowDownLeft className="h-4 w-4 text-red-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTypeLabel = () => {
    const labels: Record<StakeTransaction['type'], string> = {
      STAKE: 'Stake',
      UNSTAKE: 'Unstake',
      CLAIM_REWARDS: 'Claim Rewards',
      POOL_DEPOSIT: 'Pool Deposit',
      POOL_WITHDRAWAL: 'Pool Withdrawal',
    };
    return labels[transaction.type];
  };

  const getStatusBadge = () => {
    const variants: Record<StakeTransaction['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
      COMPLETED: 'default',
      PENDING: 'secondary',
      FAILED: 'destructive',
      CANCELLED: 'outline',
    };

    const statusLabels: Record<StakeTransaction['status'], string> = {
      COMPLETED: 'Completed',
      PENDING: 'Pending',
      FAILED: 'Failed',
      CANCELLED: 'Cancelled',
    };

    return (
      <Badge variant={variants[transaction.status]}>
        {statusLabels[transaction.status]}
      </Badge>
    );
  };

  const getAmountColor = () => {
    if (transaction.type === 'UNSTAKE' || transaction.type === 'POOL_WITHDRAWAL') return 'text-orange-600';
    if (transaction.type === 'STAKE' || transaction.type === 'POOL_DEPOSIT') return 'text-green-600';
    return 'text-blue-600';
  };

  const getAmountPrefix = () => {
    if (transaction.type === 'UNSTAKE' || transaction.type === 'POOL_WITHDRAWAL') return '-';
    return '+';
  };

  const formatTxHash = (hash: string | null) => {
    if (!hash) return null;
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
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
              <span className="font-medium">Pool {transaction.pool_id}</span>
            )}
            {getStatusBadge()}
            {transaction.blockchain_confirmed && (
              <Badge variant="outline" className="border-green-600 text-green-600">
                Confirmed
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{getTypeLabel()}</span>
            <span>•</span>
            <span>{new Date(transaction.created_at).toLocaleString()}</span>
            {transaction.transaction_hash && (
              <>
                <span>•</span>
                <a
                  href={`https://arbiscan.io/tx/${transaction.transaction_hash}`}
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
          {transaction.shares && (
            <div className="text-xs text-muted-foreground">
              Shares: {transaction.shares.toLocaleString()}
            </div>
          )}
          {transaction.error_message && (
            <div className="text-xs text-red-600">
              Error: {transaction.error_message}
            </div>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className={`text-lg font-semibold ${getAmountColor()}`}>
          {getAmountPrefix()}${transaction.amount.toLocaleString()}
        </p>
        {transaction.pool && (
          <p className="text-xs text-muted-foreground">
            APY: {transaction.pool.annualized_return}%
          </p>
        )}
      </div>
    </div>
  );
}

function TransactionStatsSkeleton() {
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
