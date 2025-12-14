import 'server-only';

import { KYCVerification, KYCVerificationStatus } from '@prisma/client';
import prisma from '@prisma/index';

export const createKycVerification = async (
  data: Pick<KYCVerification, 'accountAddress' | 'identityVerificationId'>
) => {
  // Normalize address to lowercase for case-insensitive matching
  // EVM addresses are case-insensitive but Prisma connect is case-sensitive
  const normalizedAddress = data.accountAddress.toLowerCase();

  return prisma.kYCVerification.create({
    data: {
      identityVerificationId: data.identityVerificationId,
      account: {
        connect: {
          address: normalizedAddress,
        },
      },
    },
  });
};

// plaid webhook increments the attempts count of the kyc verification
export const incrementAttemptsCountOfKycVerification = async (identityVerificationId: string) => {
  return prisma.kYCVerification.update({
    where: { identityVerificationId },
    data: { attempts: { increment: 1 } },
  });
};

// plaid webhook updates the status of the kyc verification
export const updateStatusOfKycVerification = async (data: {
  identityVerificationId: string;
  status: KYCVerificationStatus;
}) => {
  return prisma.kYCVerification.update({
    where: {
      identityVerificationId: data.identityVerificationId,
    },
    data: {
      status: data.status,
    },
  });
};

export const getKycVerification = async ({
  accountAddress,
  identityVerificationId,
}: {
  accountAddress?: string;
  identityVerificationId?: string;
}): Promise<KYCVerification | null> => {
  if (!accountAddress && !identityVerificationId) {
    throw new Error('Either accountAddress or identityVerificationId is required');
  }

  // Normalize address to lowercase for case-insensitive matching
  const normalizedAddress = accountAddress?.toLowerCase();

  /*
    query by accountAddress AND identityVerificationId if both are provided
    otherwise query by either accountAddress or identityVerificationId
  */
  const record = await prisma.kYCVerification.findFirst({
    where: {
      OR: [
        ...(normalizedAddress ? [{ accountAddress: normalizedAddress }] : []),
        ...(identityVerificationId ? [{ identityVerificationId }] : []),
      ],
    },
  });

  return record;
};
