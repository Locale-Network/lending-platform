'use server';

import { balanceOf, getStakingTokenBalance, getStakingTokenSymbol } from '@/services/contracts/token';

export const getTokenBalanceAction = async (address: string) => {
  try {
    const balance = await balanceOf(address);
    return balance;
  } catch (error) {
    // Return 0 if token contract is not deployed or fails to read
    // Silently fail during development when contract is not deployed
    if (process.env.NODE_ENV === 'development') {
      return 0;
    }
    console.warn('Failed to fetch token balance:', error);
    return 0;
  }
};

/**
 * Get the staking token (USDC) balance and symbol for an address
 */
export const getStakingTokenBalanceAction = async (address: string): Promise<{ balance: number; symbol: string }> => {
  try {
    const [balance, symbol] = await Promise.all([
      getStakingTokenBalance(address),
      getStakingTokenSymbol(),
    ]);
    return { balance, symbol };
  } catch (error) {
    // Return defaults if staking pool contract is not deployed or fails to read
    if (process.env.NODE_ENV === 'development') {
      return { balance: 0, symbol: 'USDC' };
    }
    console.warn('Failed to fetch staking token balance:', error);
    return { balance: 0, symbol: 'USDC' };
  }
};
