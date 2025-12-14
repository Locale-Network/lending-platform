import 'server-only';

import prisma from '@prisma/index';
import { CreditScore } from '@prisma/client';

export type SaveCreditScoreArgs = Pick<CreditScore, 'creditScoreEquifax' | 'creditScoreTransUnion'>;

export const saveCreditScoreOfLoanApplication = async (args: {
  creditScore: SaveCreditScoreArgs;
  loanApplicationId: string;
}): Promise<void> => {
  const { creditScore, loanApplicationId } = args;

  await prisma.creditScore.create({
    data: {
      ...creditScore,
      loanApplication: {
        connect: {
          id: loanApplicationId,
        },
      },
    },
  });
};

export async function getLatestCreditScoreOfLoanApplication(loanApplicationId: string) {
  const result = await prisma.creditScore.findFirstOrThrow({
    where: {
      loanApplicationId,
    },
  });

  return result;
}
