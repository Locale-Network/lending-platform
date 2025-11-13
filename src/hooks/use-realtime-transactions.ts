'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@account-kit/react';

export type StakeTransaction = {
  id: string;
  investor_address: string;
  pool_id: string;
  type: 'STAKE' | 'UNSTAKE' | 'CLAIM_REWARDS' | 'POOL_DEPOSIT' | 'POOL_WITHDRAWAL';
  amount: number;
  shares: number | null;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  transaction_hash: string | null;
  blockchain_confirmed: boolean;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

/**
 * Hook to subscribe to realtime transaction updates from Supabase
 * @param onUpdate - Callback function when a transaction is updated
 * @param onInsert - Callback function when a new transaction is created
 * @param onDelete - Callback function when a transaction is deleted
 */
export function useRealtimeTransactions(
  onUpdate?: (transaction: StakeTransaction) => void,
  onInsert?: (transaction: StakeTransaction) => void,
  onDelete?: (transaction: StakeTransaction) => void
) {
  const user = useUser();
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsSubscribed(false);
      return;
    }

    const supabase = createClient();

    // Get user's wallet address first
    const setupSubscription = async () => {
      try {
        // Fetch user's account to get wallet address
        const { data: accountData } = await supabase
          .from('accounts')
          .select('address')
          .eq('id', user.address)
          .single();

        if (!accountData) {
          console.error('No account found for user');
          return;
        }

        // Subscribe to stake_transactions table for this user's address
        const channel = supabase
          .channel('stake_transactions_changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'stake_transactions',
              filter: `investor_address=eq.${accountData.address}`,
            },
            (payload) => {
              console.log('Realtime update received:', payload);

              switch (payload.eventType) {
                case 'INSERT':
                  if (onInsert) {
                    onInsert(payload.new as StakeTransaction);
                  }
                  break;
                case 'UPDATE':
                  if (onUpdate) {
                    onUpdate(payload.new as StakeTransaction);
                  }
                  break;
                case 'DELETE':
                  if (onDelete) {
                    onDelete(payload.old as StakeTransaction);
                  }
                  break;
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              setIsSubscribed(true);
              console.log('Subscribed to stake_transactions realtime updates');
            } else if (status === 'CHANNEL_ERROR') {
              setIsSubscribed(false);
              console.error('Error subscribing to realtime updates');
            }
          });

        // Cleanup subscription on unmount
        return () => {
          channel.unsubscribe();
          setIsSubscribed(false);
        };
      } catch (error) {
        console.error('Error setting up realtime subscription:', error);
        setIsSubscribed(false);
      }
    };

    setupSubscription();
  }, [user, onUpdate, onInsert, onDelete]);

  return { isSubscribed };
}
