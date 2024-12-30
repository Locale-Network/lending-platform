'use server';

import { balanceOf } from '@/services/contracts/token';

export const getTokenBalanceAction = async (address: string) => {
  const balance = await balanceOf(address);

  return balance;
};
