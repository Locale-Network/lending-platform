import 'server-only';

import { PlaidItemAccessToken } from '@prisma/client';
import prisma from '@prisma/index';

export const saveItemAccessToken = async (
  data: Pick<
    PlaidItemAccessToken,
    'accessToken' | 'itemId' | 'accountAddress' | 'loanApplicationId'
  >
) => {
  // Normalize address to lowercase for case-insensitive matching
  const normalizedAddress = data.accountAddress.toLowerCase();

  await prisma.plaidItemAccessToken.create({
    data: {
      accessToken: data.accessToken,
      itemId: data.itemId,
      account: {
        connect: {
          address: normalizedAddress,
        },
      },
      loanApplication: {
        connect: {
          id: data.loanApplicationId,
        },
      },
    },
  });
};

export const getItemAccessTokensForChainAccount = async (
  accountAddress: string
): Promise<PlaidItemAccessToken[]> => {
  // Normalize address to lowercase for case-insensitive matching
  const normalizedAddress = accountAddress.toLowerCase();

  return prisma.plaidItemAccessToken.findMany({
    where: { accountAddress: normalizedAddress },
  });
};
