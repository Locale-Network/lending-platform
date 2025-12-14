'use server';

import prisma from '@prisma/index';
import { Role } from '@prisma/client';

export async function getRoleOfAccount(accountAddress: string): Promise<Role> {
  const account = await prisma.account.findUnique({
    where: {
      address: accountAddress,
    },
  });
  return account?.role ?? Role.BORROWER;
}
