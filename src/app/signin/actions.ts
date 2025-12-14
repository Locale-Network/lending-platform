'use server';
import { isAddress } from 'viem';

import { upsertAccount } from '@/services/db/accounts';
import { Account } from '@prisma/client';

export async function signIn(address: string): Promise<Account | null> {
  try {
    if (!isAddress(address)) {
      return null;
    }

    // Create or update the account in the database
    // Alchemy has already authenticated the user, so no session check needed
    const account = await upsertAccount(address);

    return account;
  } catch (error) {
    console.error('Error in signIn action:', error);
    return null;
  }
}
