import 'server-only';

import prisma from '@prisma/index';
import { DebtService } from '@prisma/client';

export type SaveDebtServiceArgs = Pick<DebtService, 'transactionCount'>;

export const saveDebtServiceOfLoanApplication = async (args: {
  debtService: SaveDebtServiceArgs;
  loanApplicationId: string;
}): Promise<void> => {
  const { debtService, loanApplicationId } = args;

  await prisma.debtService.create({
    data: {
      ...debtService,
      loanApplication: {
        connect: {
          id: loanApplicationId,
        },
      },
    },
  });
};

export async function getLatestDebtServiceOfLoanApplication(loanApplicationId: string) {
  const result = await prisma.debtService.findFirstOrThrow({
    where: {
      loanApplicationId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return result;
}
