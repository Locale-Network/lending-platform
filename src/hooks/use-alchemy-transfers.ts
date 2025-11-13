'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@account-kit/react';

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
 */
export function useAlchemyTransfers(category: string = 'external') {
  const user = useUser();
  const [transfers, setTransfers] = useState<AlchemyTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageKey, setPageKey] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);

  const fetchTransfers = async (reset = false) => {
    if (!user?.address) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        address: user.address,
        category,
      });

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
  };

  useEffect(() => {
    if (user?.address) {
      fetchTransfers(true);
    }
  }, [user?.address, category]);

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
