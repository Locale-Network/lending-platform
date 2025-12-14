'use client';

import { useState } from 'react';
import { useWalletAuth } from '@/hooks/useWalletAuth';

interface StakeResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

interface UnstakeResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

export function usePoolStake() {
  const { address, isConnected } = useWalletAuth();
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);

  /**
   * Stake tokens into a pool
   * @param poolId - The pool ID to stake into
   * @param amount - The amount to stake in USD
   * @returns StakeResult with success status and transaction details
   */
  const stake = async (poolId: string, amount: number): Promise<StakeResult> => {
    if (!isConnected || !address) {
      return {
        success: false,
        error: 'User not authenticated. Please connect your wallet.',
      };
    }

    setIsStaking(true);

    try {
      // Call the staking API endpoint
      const response = await fetch('/api/pools/stake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          poolId,
          amount,
          userAddress: address,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to stake');
      }

      return {
        success: true,
        transactionHash: data.transactionHash,
      };
    } catch (error) {
      console.error('Staking error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    } finally {
      setIsStaking(false);
    }
  };

  /**
   * Unstake tokens from a pool
   * @param poolId - The pool ID to unstake from
   * @param amount - The amount to unstake in USD
   * @returns UnstakeResult with success status and transaction details
   */
  const unstake = async (poolId: string, amount: number): Promise<UnstakeResult> => {
    if (!isConnected || !address) {
      return {
        success: false,
        error: 'User not authenticated. Please connect your wallet.',
      };
    }

    setIsUnstaking(true);

    try {
      // Call the unstaking API endpoint
      const response = await fetch('/api/pools/unstake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          poolId,
          amount,
          userAddress: address,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to unstake');
      }

      return {
        success: true,
        transactionHash: data.transactionHash,
      };
    } catch (error) {
      console.error('Unstaking error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    } finally {
      setIsUnstaking(false);
    }
  };

  /**
   * Get user's stake in a specific pool
   * @param poolId - The pool ID to query
   * @returns User's stake information
   */
  const getUserStake = async (poolId: string) => {
    if (!isConnected || !address) {
      return null;
    }

    try {
      const response = await fetch(`/api/pools/${poolId}/user-stake?address=${address}`);

      if (!response.ok) {
        throw new Error('Failed to fetch user stake');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching user stake:', error);
      return null;
    }
  };

  return {
    stake,
    unstake,
    getUserStake,
    isStaking,
    isUnstaking,
    address,
    isConnected,
  };
}
