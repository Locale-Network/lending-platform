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
} from 'lucide-react';
import { getExplorerUrl } from '@/lib/explorer';

interface AdminTransactionsHistoryProps {
  loanApplicationId: string;
  borrowerAddress: string;
}

interface ProofHistory {
  verified: boolean;
  proofHash?: string;
  verifiedAt?: string;
  transactionCount?: number;
}

interface VerificationRecord {
  id: string;
  source: 'cartesi' | 'onchain';
  loanId: string;
  borrowerAddress: string;
  dscrValue: number;
  dscrValueFormatted: string;
  interestRate: number;
  interestRateFormatted: string;
  proofHash: string;
  transactionCount: number;
  meetsThreshold: boolean;
  verifiedAt: string;
  verificationId?: number;
  onchainTxHash?: string;
  explorerUrl?: string | null;
  relayedToChain: boolean;
}

interface VerificationHistoryResponse {
  loanId: string;
  verifications: VerificationRecord[];
  summary: {
    totalVerifications: number;
    onchainVerified: boolean;
    latestDscr: string | null;
    latestInterestRate: string | null;
    contractAddress: string;
    contractExplorerUrl: string | null;
  };
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

/**
 * Admin Transactions History Component
 *
 * Displays a unified view of:
 * - Verification proof history
 * - Wallet transfers (money in/out)
 * - Monthly payment tracking
 *
 * NOTE: Bank tab is excluded for admin view
 */
export default function AdminTransactionsHistory({
  loanApplicationId,
  borrowerAddress,
}: AdminTransactionsHistoryProps) {
  const [activeTab, setActiveTab] = useState('wallet');
  const [proofHistory, setProofHistory] = useState<ProofHistory | null>(null);
  const [verificationHistory, setVerificationHistory] = useState<VerificationHistoryResponse | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(true);
  const [walletTransfers, setWalletTransfers] = useState<WalletTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [pageKey, setPageKey] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);

  // Fetch proof history (legacy)
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

  // Fetch verification history from Cartesi
  const fetchVerificationHistory = useCallback(async () => {
    try {
      setVerificationLoading(true);
      const response = await fetch(`/api/loan/${loanApplicationId}/verification-history`);
      if (response.ok) {
        const data: VerificationHistoryResponse = await response.json();
        setVerificationHistory(data);
      }
    } catch (error) {
      console.error('Failed to fetch verification history:', error);
    } finally {
      setVerificationLoading(false);
    }
  }, [loanApplicationId]);

  useEffect(() => {
    fetchVerificationHistory();
  }, [fetchVerificationHistory]);

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
    fetchTransfers(true);
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
            disabled={transfersLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${transfersLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* NOTE: Bank tab excluded for admin view - only 3 tabs */}
          <TabsList className="grid w-full grid-cols-3">
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
                                href={getExplorerUrl('tx', transfer.hash)}
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
                        <RefreshCw className="h-4 w-4 animate-spin" />
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
            {verificationLoading ? (
              <div className="space-y-4">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-64" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : verificationHistory && verificationHistory.verifications.length > 0 ? (
              <div className="space-y-4">
                {/* Summary */}
                {verificationHistory.summary.onchainVerified && (
                  <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-green-800">On-Chain Verified</p>
                        <p className="text-sm text-green-600">
                          DSCR: {verificationHistory.summary.latestDscr} | Rate: {verificationHistory.summary.latestInterestRate}
                        </p>
                      </div>
                    </div>
                    {verificationHistory.summary.contractExplorerUrl && (
                      <a
                        href={verificationHistory.summary.contractExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-green-700 hover:underline"
                      >
                        View Contract
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}

                {/* Verification History List */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Verification History (from Cartesi)</h4>
                  {verificationHistory.verifications.map((verification) => (
                    <div
                      key={verification.id}
                      className={`rounded-lg border p-4 ${
                        verification.relayedToChain ? 'border-green-200 bg-green-50/50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                            verification.source === 'onchain' ? 'bg-green-100' :
                            verification.relayedToChain ? 'bg-green-100' : 'bg-blue-100'
                          }`}>
                            {verification.source === 'onchain' || verification.relayedToChain ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <Shield className="h-5 w-5 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                DSCR: {verification.dscrValueFormatted}
                              </p>
                              <Badge variant={verification.meetsThreshold ? 'default' : 'destructive'} className="text-xs">
                                {verification.meetsThreshold ? 'Meets Threshold' : 'Below Threshold'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Interest Rate: {verification.interestRateFormatted}
                              {verification.transactionCount > 0 && ` | ${verification.transactionCount} transactions`}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={verification.relayedToChain ? 'default' : 'secondary'} className="text-xs">
                            {verification.source === 'onchain' ? 'On-Chain' :
                             verification.relayedToChain ? 'Relayed' : 'Cartesi'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(verification.verifiedAt)}
                          </span>
                        </div>
                      </div>

                      {/* Proof Hash */}
                      <div className="mt-3 rounded bg-gray-100 p-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Hash className="h-3 w-3" />
                            <span>Proof Hash</span>
                          </div>
                          {verification.explorerUrl && (
                            <a
                              href={verification.explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                              View on Explorer
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <p className="mt-1 break-all font-mono text-xs">{verification.proofHash}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <Shield className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">
                  No verification proofs available yet.
                </p>
              </div>
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
