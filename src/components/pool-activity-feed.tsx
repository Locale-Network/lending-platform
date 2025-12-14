'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, RefreshCw, ArrowUpRight, ArrowDownLeft, Users } from 'lucide-react';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

/**
 * Pool Activity Feed - Shows all activity in pools the user is invested in
 * This includes stakes/unstakes from ALL users, helping investors track pool health
 */
export function PoolActivityFeed() {
  const { address, isConnected } = useWalletAuth();

  // Fetch pool activity from the staking pool
  const { data, error, isLoading, mutate } = useSWR(
    '/api/pools/real-estate-bridge/activity',
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  );

  const transactions = data?.transactions || [];

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Pool Activity
          </CardTitle>
          <CardDescription>Connect your wallet to view pool activity</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Please connect your wallet to view pool activity
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Pool Activity
          </CardTitle>
          <CardDescription>Activity in your invested pools</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">Failed to load pool activity</p>
            <Button onClick={() => mutate()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatAddress = (txAddress: string) => {
    if (!txAddress) return 'Unknown';
    // Check if it's the current user
    if (txAddress.toLowerCase() === address?.toLowerCase()) {
      return 'You';
    }
    return `${txAddress.slice(0, 6)}...${txAddress.slice(-4)}`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'stake':
        return <ArrowUpRight className="h-4 w-4 text-green-600" />;
      case 'unstake':
        return <ArrowDownLeft className="h-4 w-4 text-orange-600" />;
      default:
        return <ArrowUpRight className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      stake: 'Staked',
      unstake: 'Unstaked',
    };
    return labels[type] || type;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Pool Activity
            </CardTitle>
            <CardDescription>
              Real-time activity in your invested pools (all investors)
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && transactions.length === 0 ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gray-300" />
                  <div className="space-y-1">
                    <div className="h-4 w-32 bg-gray-300 rounded" />
                    <div className="h-3 w-24 bg-gray-300 rounded" />
                  </div>
                </div>
                <div className="h-5 w-20 bg-gray-300 rounded" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No pool activity yet. Activity will appear here when investors stake or unstake.
          </p>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx: any) => {
              const isCurrentUser = tx.user_address?.toLowerCase() === address?.toLowerCase();
              return (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    isCurrentUser ? 'bg-blue-50 border border-blue-200' : 'bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background">
                      {getTypeIcon(tx.type)}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{getTypeLabel(tx.type)}</span>
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-xs border-blue-600 text-blue-600">
                            You
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs border-green-600 text-green-600">
                          On-chain
                        </Badge>
                        {tx.transaction_hash && (
                          <a
                            href={`https://sepolia.arbiscan.io/tx/${tx.transaction_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{formatAddress(tx.user_address)}</span>
                        <span>•</span>
                        <span>{formatTimestamp(tx.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`font-semibold text-sm ${tx.type === 'stake' ? 'text-green-600' : 'text-orange-600'}`}>
                    {tx.type === 'stake' ? '+' : '-'}{tx.amount?.toLocaleString() || 0} USDC
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {data?.source === 'blockchain' && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Data sourced directly from Arbitrum Sepolia blockchain
          </p>
        )}
      </CardContent>
    </Card>
  );
}
