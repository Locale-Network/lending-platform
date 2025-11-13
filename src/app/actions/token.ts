'use server';

import { balanceOf } from '@/services/contracts/token';

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
