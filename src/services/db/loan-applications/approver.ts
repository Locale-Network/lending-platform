import 'server-only';

import prisma from '@prisma/index';
import {
  Account,
  CreditScore,
  LoanApplication,
  LoanApplicationStatus,
  OutstandingLoan,
  DebtService,
} from '@prisma/client';

export type LoanApplicationDetails = LoanApplication & {
  creditScore: CreditScore[] | null;
  debtService: DebtService[] | null;
  account: Account;
  outstandingLoans: OutstandingLoan[];
};

export const getLoanApplication = async (args: {
  loanApplicationId: string;
}): Promise<LoanApplicationDetails | null> => {
  const { loanApplicationId } = args;
  const result = await prisma.loanApplication.findUnique({
    where: { id: loanApplicationId },
    include: {
      creditScore: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
      debtService: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
      account: true,
      outstandingLoans: true,
    },
  });
  return result;
};

export const getSubmittedLoanApplications = async (): Promise<
  (LoanApplication & {
    creditScore: CreditScore[] | null;
    debtService: DebtService[] | null;
    account: Account;
  })[]
> => {
  const result = await prisma.loanApplication.findMany({
    where: {
      isSubmitted: true,
      status: {
        not: LoanApplicationStatus.DRAFT,
      },
    },
    include: {
      creditScore: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
      debtService: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
      account: true,
    },
    orderBy: [{ createdAt: 'desc' }, { updatedAt: 'desc' }],
  });
  return result;
};

export const updateLoanApplication = async (args: {
  loanApplicationId: string;
  loanApplication: Partial<LoanApplication>;
}) => {
  const { loanApplicationId, loanApplication } = args;
  await prisma.loanApplication.update({
    where: { id: loanApplicationId },
    data: loanApplication,
  });
};
