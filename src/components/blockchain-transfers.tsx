'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, RefreshCw, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useAlchemyTransfers } from '@/hooks/use-alchemy-transfers';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { getExplorerUrl } from '@/lib/explorer';

export function BlockchainTransfers() {
  const { address, isConnected } = useWalletAuth();
  const stakingPoolAddress = process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS;
  const { transfers, loading, error, hasMore, loadMore, refresh } = useAlchemyTransfers('erc20', stakingPoolAddress);

  if (!isConnected || !address) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>Connect your wallet to view staking activity</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Please connect your wallet to view staking activity
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>Staking pool transaction history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={refresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatValue = (value: number) => {
    return value.toFixed(6);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Staking pool transactions on Arbitrum Sepolia</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && transfers.length === 0 ? (
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
        ) : transfers.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No blockchain transactions found
          </p>
        ) : (
          <>
            <div className="space-y-4">
              {transfers.map((transfer) => (
                <div
                  key={transfer.hash}
                  className="flex items-center justify-between border-b pb-4 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      {transfer.from.toLowerCase() === address?.toLowerCase() ? (
                        <ArrowUpRight className="h-4 w-4 text-orange-600" />
                      ) : (
                        <ArrowDownLeft className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {transfer.from.toLowerCase() === address?.toLowerCase()
                            ? 'Sent'
                            : 'Received'}
                        </span>
                        <Badge variant="outline">{transfer.category}</Badge>
                        <Badge variant="outline" className="border-green-600 text-green-600">
                          On-chain
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>
                          {transfer.from.toLowerCase() === address?.toLowerCase()
                            ? `To: ${formatAddress(transfer.to)}`
                            : `From: ${formatAddress(transfer.from)}`}
                        </span>
                        <span>•</span>
                        <span>Block: {parseInt(transfer.blockNum, 16)}</span>
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
                          className="hover:underline flex items-center gap-1"
                        >
                          View on Arbiscan
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-semibold ${
                        transfer.from.toLowerCase() === address?.toLowerCase()
                          ? 'text-orange-600'
                          : 'text-green-600'
                      }`}
                    >
                      {transfer.from.toLowerCase() === address?.toLowerCase() ? '-' : '+'}
                      {formatValue(transfer.value)} {transfer.asset}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loading}
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
