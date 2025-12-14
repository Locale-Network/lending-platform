'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWalletAuth } from '@/hooks/useWalletAuth';

export type AlchemyTransfer = {
  hash: string;
  blockNum: string;
  from: string;
  to: string;
  value: number;
  asset: string;
  category: string;
  rawContract: {
    address: string;
    decimal: string;
  };
  metadata: {
    blockTimestamp: string;
  };
};

export type AlchemyTransfersResponse = {
  transfers: AlchemyTransfer[];
  pageKey?: string;
  hasMore: boolean;
};

/**
 * Hook to fetch blockchain transfers using Alchemy Transfers API
 * @param category - Transfer category (external, internal, erc20, erc721, erc1155)
 * @param contractAddress - Optional contract address to filter transfers (for staking pool)
 */
export function useAlchemyTransfers(category: string = 'external', contractAddress?: string) {
  const { address, isConnected } = useWalletAuth();
  const [transfers, setTransfers] = useState<AlchemyTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageKey, setPageKey] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);

  const fetchTransfers = useCallback(async (reset = false) => {
    if (!isConnected || !address) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        address,
        category,
      });

      if (contractAddress) {
        params.append('contractAddress', contractAddress);
      }

      if (!reset && pageKey) {
        params.append('pageKey', pageKey);
      }

      const response = await fetch(`/api/alchemy/transfers?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch transfers');
      }

      const data: AlchemyTransfersResponse = await response.json();

      if (reset) {
        setTransfers(data.transfers);
      } else {
        setTransfers((prev) => [...prev, ...data.transfers]);
      }

      setPageKey(data.pageKey);
      setHasMore(data.hasMore);
    } catch (err) {
      console.error('Error fetching Alchemy transfers:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [address, isConnected, category, contractAddress, pageKey]);

  useEffect(() => {
    if (isConnected && address) {
      fetchTransfers(true);
    }
  }, [address, isConnected, category, contractAddress, fetchTransfers]);

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchTransfers(false);
    }
  };

  const refresh = () => {
    fetchTransfers(true);
  };

  return {
    transfers,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}
