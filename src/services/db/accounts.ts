import 'server-only';

import prisma from '@prisma/index';
import { Account } from '@prisma/client';

export async function upsertAccount(address: string): Promise<Account> {
  const result = await prisma.account.upsert({
    where: { address },
    create: { address },
    update: {
      updatedAt: new Date().toISOString(), // existing accounts login in
    },
  });

  return result;
}
