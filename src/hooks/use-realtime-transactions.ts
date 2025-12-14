'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWalletAuth } from '@/hooks/useWalletAuth';

// Event types from blockchain indexer
export type StakingEventType = 'STAKED' | 'UNSTAKE_REQUESTED' | 'UNSTAKED';

// Transaction types for display
export type TransactionType = 'stake' | 'unstake_request' | 'unstake';
export type TransactionStatus = 'pending' | 'completed';

export type StakeTransaction = {
  id: string;
  investor_address: string;
  pool_id: string;
  type: TransactionType;
  amount: number;
  shares: number | null;
  status: TransactionStatus;
  transaction_hash: string | null;
  block_number: number | null;
  unlock_time: string | null;
  created_at: string;
  pool?: {
    id: string;
    name: string;
    slug: string;
    annualized_return: number | null;
  };
};

// Raw staking event from database (amounts stored as text for precision)
type StakingEvent = {
  id: string;
  user_address: string;
  pool_id: string;
  event_type: StakingEventType;
  amount: string; // Stored as text in DB
  shares: string | null; // Stored as text in DB
  transaction_hash: string | null;
  block_number: number | null;
  unlock_time: string | null;
  created_at: string;
};

// Map blockchain event types to display-friendly transaction types
function mapEventType(eventType: StakingEventType): TransactionType {
  switch (eventType) {
    case 'STAKED':
      return 'stake';
    case 'UNSTAKE_REQUESTED':
      return 'unstake_request';
    case 'UNSTAKED':
      return 'unstake';
    default:
      return 'stake';
  }
}

// Map event type to status
function getStatusFromEvent(eventType: StakingEventType): TransactionStatus {
  switch (eventType) {
    case 'STAKED':
      return 'completed';
    case 'UNSTAKE_REQUESTED':
      return 'pending';
    case 'UNSTAKED':
      return 'completed';
    default:
      return 'completed';
  }
}

// Transform a staking event to a transaction format
function transformEventToTransaction(event: StakingEvent): StakeTransaction {
  // Convert amount from wei string to number (USDC has 6 decimals)
  const amountInWei = BigInt(event.amount || '0');
  const amountInUsdc = Number(amountInWei) / 1e6;

  const sharesValue = event.shares ? Number(BigInt(event.shares)) / 1e18 : null;

  return {
    id: event.id,
    investor_address: event.user_address,
    pool_id: event.pool_id,
    type: mapEventType(event.event_type),
    amount: amountInUsdc,
    shares: sharesValue,
    status: getStatusFromEvent(event.event_type),
    transaction_hash: event.transaction_hash,
    block_number: event.block_number,
    unlock_time: event.unlock_time,
    created_at: event.created_at,
  };
}

/**
 * Hook to subscribe to realtime staking event updates from Supabase
 * @param onUpdate - Callback function when a transaction is updated
 * @param onInsert - Callback function when a new transaction is created
 * @param onDelete - Callback function when a transaction is deleted
 */
export function useRealtimeTransactions(
  onUpdate?: (transaction: StakeTransaction) => void,
  onInsert?: (transaction: StakeTransaction) => void,
  onDelete?: (transaction: StakeTransaction) => void
) {
  const { address } = useWalletAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!address) {
      setIsSubscribed(false);
      return;
    }

    const supabase = createClient();
    const userAddress = address.toLowerCase();

    // Subscribe to staking_events table for this user's address
    const channel = supabase
      .channel('staking_events_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staking_events',
          filter: `user_address=eq.${userAddress}`,
        },
        (payload) => {
          console.log('Realtime staking event received:', payload);

          switch (payload.eventType) {
            case 'INSERT':
              if (onInsert) {
                onInsert(transformEventToTransaction(payload.new as StakingEvent));
              }
              break;
            case 'UPDATE':
              if (onUpdate) {
                onUpdate(transformEventToTransaction(payload.new as StakingEvent));
              }
              break;
            case 'DELETE':
              if (onDelete) {
                onDelete(transformEventToTransaction(payload.old as StakingEvent));
              }
              break;
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsSubscribed(true);
          console.log('Subscribed to staking_events realtime updates');
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
  }, [address, onUpdate, onInsert, onDelete]);

  return { isSubscribed };
}
