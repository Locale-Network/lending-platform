'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  Hash,
  Calendar,
  DollarSign,
  Building2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface TransactionsHistoryProps {
  loanApplicationId: string;
  borrowerAddress: string;
}

interface ProofHistory {
  verified: boolean;
  proofHash?: string;
  verifiedAt?: string;
  transactionCount?: number;
}

interface WalletTransfer {
  hash: string;
  blockNum: string;
  from: string;
  to: string;
  value: number;
  asset: string;
  category: string;
  metadata: {
    blockTimestamp: string;
  };
}

interface TransfersResponse {
  transfers: WalletTransfer[];
  pageKey?: string;
  hasMore: boolean;
}

interface BankTransaction {
  id: string;
  date: string;
  name: string;
  merchant: string | null;
  amount: number;
  currency: string;
  category: string;
  categoryDetail: string;
  pending: boolean;
  type: 'income' | 'expense';
}

interface BankTransactionsSummary {
  totalTransactions: number;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  categoryBreakdown: Record<string, { count: number; total: number }>;
}

interface BankTransactionsResponse {
  transactions: BankTransaction[];
  summary: BankTransactionsSummary;
  error?: string;
  requiresReauth?: boolean;
}

/**
 * Transactions History Component
 *
 * Displays a unified view of:
 * - Verification proof history
 * - Wallet transfers (money in/out)
 * - Monthly payment tracking
 */
export default function TransactionsHistory({
  loanApplicationId,
  borrowerAddress,
}: TransactionsHistoryProps) {
  const [activeTab, setActiveTab] = useState('bank');
  const [proofHistory, setProofHistory] = useState<ProofHistory | null>(null);
  const [walletTransfers, setWalletTransfers] = useState<WalletTransfer[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [bankSummary, setBankSummary] = useState<BankTransactionsSummary | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [bankLoading, setBankLoading] = useState(true);
  const [pageKey, setPageKey] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);

  // Fetch proof history
  useEffect(() => {
    async function fetchProofHistory() {
      try {
        const response = await fetch(`/api/loan/${loanApplicationId}/dscr-status`);
        if (response.ok) {
          const data = await response.json();
          setProofHistory(data);
        }
      } catch (error) {
        console.error('Failed to fetch proof history:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProofHistory();
  }, [loanApplicationId]);

  // Fetch bank transactions from Plaid
  const fetchBankTransactions = useCallback(async () => {
    try {
      setBankLoading(true);
      setBankError(null);

      const response = await fetch(`/api/loan/${loanApplicationId}/bank-transactions`);
      if (response.ok) {
        const data: BankTransactionsResponse = await response.json();
        if (data.error) {
          setBankError(data.error);
        } else {
          setBankTransactions(data.transactions);
          setBankSummary(data.summary);
        }
      } else {
        setBankError('Failed to fetch bank transactions');
      }
    } catch (error) {
      console.error('Failed to fetch bank transactions:', error);
      setBankError('Failed to load bank transactions');
    } finally {
      setBankLoading(false);
    }
  }, [loanApplicationId]);

  useEffect(() => {
    fetchBankTransactions();
  }, [fetchBankTransactions]);

  // Fetch wallet transfers
  const fetchTransfers = useCallback(async (reset = false) => {
    try {
      setTransfersLoading(true);
      const params = new URLSearchParams({
        address: borrowerAddress,
        category: 'erc20',
      });

      if (!reset && pageKey) {
        params.append('pageKey', pageKey);
      }

      const response = await fetch(`/api/alchemy/transfers?${params.toString()}`);
      if (response.ok) {
        const data: TransfersResponse = await response.json();
        if (reset) {
          setWalletTransfers(data.transfers);
        } else {
          setWalletTransfers((prev) => [...prev, ...data.transfers]);
        }
        setPageKey(data.pageKey);
        setHasMore(data.hasMore);
      }
    } catch (error) {
      console.error('Failed to fetch wallet transfers:', error);
    } finally {
      setTransfersLoading(false);
    }
  }, [borrowerAddress, pageKey]);

  useEffect(() => {
    if (borrowerAddress) {
      fetchTransfers(true);
    }
  }, [borrowerAddress]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatValue = (value: number) => {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  const handleRefresh = () => {
    if (activeTab === 'bank') {
      fetchBankTransactions();
    } else {
      fetchTransfers(true);
    }
  };

  const handleLoadMore = () => {
    if (!transfersLoading && hasMore) {
      fetchTransfers(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full animate-pulse">
        <CardHeader>
          <div className="h-6 w-48 rounded bg-gray-200" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-gray-200" />
            <div className="h-4 w-3/4 rounded bg-gray-200" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">Transaction History</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={transfersLoading || bankLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${(transfersLoading || bankLoading) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="bank">
              <Building2 className="h-4 w-4 mr-2" />
              Bank
            </TabsTrigger>
            <TabsTrigger value="wallet">
              <DollarSign className="h-4 w-4 mr-2" />
              Wallet
            </TabsTrigger>
            <TabsTrigger value="proofs">
              <Shield className="h-4 w-4 mr-2" />
              Verifications
            </TabsTrigger>
            <TabsTrigger value="payments">
              <Calendar className="h-4 w-4 mr-2" />
              Payments
            </TabsTrigger>
          </TabsList>

          {/* Bank Transactions Tab */}
          <TabsContent value="bank" className="mt-4">
            {/* Summary Cards */}
            {bankSummary && (
              <div className="mb-6 grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span>Total Income</span>
                  </div>
                  <p className="mt-1 text-xl font-bold text-green-600">
                    ${bankSummary.totalIncome.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingDown className="h-4 w-4 text-orange-600" />
                    <span>Total Expenses</span>
                  </div>
                  <p className="mt-1 text-xl font-bold text-orange-600">
                    ${bankSummary.totalExpenses.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    <span>Net Cash Flow</span>
                  </div>
                  <p className={`mt-1 text-xl font-bold ${bankSummary.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${bankSummary.netCashFlow.toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {bankLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-24" />
                  </div>
                ))}
              </div>
            ) : bankError ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">{bankError}</p>
                <Button variant="outline" size="sm" onClick={fetchBankTransactions} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : bankTransactions.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No bank transactions found. Connect your bank account to see transactions.
              </p>
            ) : (
              <div className="space-y-4">
                {bankTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          tx.type === 'income' ? 'bg-green-100' : 'bg-orange-100'
                        }`}
                      >
                        {tx.type === 'income' ? (
                          <ArrowDownLeft className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-orange-600" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{tx.merchant || tx.name}</span>
                          {tx.pending && (
                            <Badge variant="outline" className="text-xs">
                              Pending
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="secondary" className="text-xs">
                            {tx.category}
                          </Badge>
                          <span>•</span>
                          <span>{new Date(tx.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-lg font-semibold ${
                          tx.type === 'income' ? 'text-green-600' : 'text-orange-600'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Wallet Activity Tab */}
          <TabsContent value="wallet" className="mt-4">
            {transfersLoading && walletTransfers.length === 0 ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
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
            ) : walletTransfers.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No wallet transactions found
              </p>
            ) : (
              <>
                <div className="space-y-4">
                  {walletTransfers.map((transfer) => {
                    const isSent = transfer.from.toLowerCase() === borrowerAddress.toLowerCase();
                    return (
                      <div
                        key={transfer.hash}
                        className="flex items-center justify-between border-b pb-4 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full ${
                              isSent ? 'bg-orange-100' : 'bg-green-100'
                            }`}
                          >
                            {isSent ? (
                              <ArrowUpRight className="h-4 w-4 text-orange-600" />
                            ) : (
                              <ArrowDownLeft className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{isSent ? 'Sent' : 'Received'}</span>
                              <Badge variant="outline" className="text-xs">
                                {transfer.asset}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                              <span>
                                {isSent
                                  ? `To: ${formatAddress(transfer.to)}`
                                  : `From: ${formatAddress(transfer.from)}`}
                              </span>
                              {transfer.metadata?.blockTimestamp && (
                                <>
                                  <span>•</span>
                                  <span>{formatTimestamp(transfer.metadata.blockTimestamp)}</span>
                                </>
                              )}
                              <span>•</span>
                              <a
                                href={`https://sepolia.arbiscan.io/tx/${transfer.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 hover:underline"
                              >
                                View
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-lg font-semibold ${
                              isSent ? 'text-orange-600' : 'text-green-600'
                            }`}
                          >
                            {isSent ? '-' : '+'}
                            {formatValue(transfer.value)} {transfer.asset}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hasMore && (
                  <div className="mt-4 text-center">
                    <Button variant="outline" onClick={handleLoadMore} disabled={transfersLoading}>
                      {transfersLoading ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        'Load More'
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Verifications Tab */}
          <TabsContent value="proofs" className="mt-4">
            {proofHistory?.verified ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Data Verification Complete</p>
                      <p className="text-sm text-muted-foreground">
                        {proofHistory.transactionCount} transactions analyzed
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-green-600">
                    Verified
                  </Badge>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Hash className="h-4 w-4" />
                    <span className="font-medium">Proof Hash</span>
                  </div>
                  <p className="mt-1 break-all font-mono text-sm">{proofHistory.proofHash}</p>
                  {proofHistory.verifiedAt && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Verified on {formatTimestamp(proofHistory.verifiedAt)}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                No verification proofs available
              </p>
            )}
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="mt-4">
            <p className="py-8 text-center text-muted-foreground">
              Payment history will appear here once loan is active
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
