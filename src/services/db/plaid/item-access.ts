import 'server-only';

import { PlaidItemAccessToken } from '@prisma/client';
import prisma from '@prisma/index';
import { encryptField, decryptField } from '@/lib/encryption';

/**
 * Plaid Access Token Storage Service
 *
 * Security: All access tokens are encrypted at rest using AES-256-GCM.
 * The encryption key is derived from DATABASE_ENCRYPTION_KEY environment variable.
 */

export const saveItemAccessToken = async (
  data: Pick<
    PlaidItemAccessToken,
    'accessToken' | 'itemId' | 'accountAddress' | 'loanApplicationId'
  >
) => {
  // Normalize address to lowercase for case-insensitive matching
  const normalizedAddress = data.accountAddress.toLowerCase();

  // Encrypt the access token before storage
  const encryptedToken = encryptField(data.accessToken);

  await prisma.plaidItemAccessToken.create({
    data: {
      accessToken: encryptedToken,
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

/**
 * Decrypt a single token record
 */
function decryptTokenRecord(
  token: PlaidItemAccessToken
): PlaidItemAccessToken {
  return {
    ...token,
    accessToken: decryptField(token.accessToken),
  };
}

export const getItemAccessTokensForChainAccount = async (
  accountAddress: string
): Promise<PlaidItemAccessToken[]> => {
  // Normalize address to lowercase for case-insensitive matching
  const normalizedAddress = accountAddress.toLowerCase();

  const encryptedTokens = await prisma.plaidItemAccessToken.findMany({
    where: { accountAddress: normalizedAddress },
  });

  // Decrypt tokens before returning
  return encryptedTokens.map(decryptTokenRecord);
};

/**
 * Get a specific access token for a loan application
 */
export const getItemAccessTokenForLoan = async (
  loanApplicationId: string
): Promise<PlaidItemAccessToken | null> => {
  const encryptedToken = await prisma.plaidItemAccessToken.findFirst({
    where: { loanApplicationId },
    orderBy: { createdAt: 'desc' },
  });

  if (!encryptedToken) return null;

  return decryptTokenRecord(encryptedToken);
};
