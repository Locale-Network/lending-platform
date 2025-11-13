'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type PoolUpdate = {
  id: string;
  total_staked: number;
  available_liquidity: number;
  total_investors: number;
  updated_at: string;
};

/**
 * Hook to subscribe to realtime pool updates from Supabase
 * @param poolId - The pool ID to subscribe to
 * @param onUpdate - Callback function when the pool is updated
 */
export function useRealtimePool(
  poolId: string | null | undefined,
  onUpdate?: (pool: PoolUpdate) => void
) {
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!poolId) {
      setIsSubscribed(false);
      return;
    }

    const supabase = createClient();

    // Subscribe to loan_pools table for this specific pool
    const channel = supabase
      .channel(`pool_${poolId}_changes`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'loan_pools',
          filter: `id=eq.${poolId}`,
        },
        (payload) => {
          console.log('Pool realtime update received:', payload);

          if (onUpdate) {
            onUpdate(payload.new as PoolUpdate);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsSubscribed(true);
          console.log(`Subscribed to pool ${poolId} realtime updates`);
        } else if (status === 'CHANNEL_ERROR') {
          setIsSubscribed(false);
          console.error('Error subscribing to pool realtime updates');
        }
      });

    // Cleanup subscription on unmount
    return () => {
      channel.unsubscribe();
      setIsSubscribed(false);
    };
  }, [poolId, onUpdate]);

  return { isSubscribed };
}
