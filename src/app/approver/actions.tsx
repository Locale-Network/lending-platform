'use server';

import {
  getSubmittedLoanApplications as dbGetSubmittedLoanApplications,
  updateLoanApplication as dbUpdateLoanApplication,
} from '@/services/db/loan-applications/approver';
import { formatAddress } from '@/utils/string';
import { LoanApplicationsForTable } from './columns';
import { authOptions } from '@/app/api/auth/auth-options';
import { ROLE_REDIRECTS } from '@/app/api/auth/auth-pages';
import { LoanApplicationStatus, Role } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { Address, isAddress } from 'viem';
import { revalidatePath } from 'next/cache';
import {
  activateLoan,
  getLoanAmount,
  getLoanRemainingMonths,
  getLoanRepaymentAmount,
} from '@/services/contracts/simpleLoanPool';
import { getTokenDecimals, getTokenSymbol } from '@/services/contracts/token';

export async function validateRequest(accountAddress: string) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/sign-in');
  }

  if (session.user.role !== Role.APPROVER && session.user.role !== Role.ADMIN) {
    redirect(ROLE_REDIRECTS[session.user.role]);
  }

  if (session?.address !== accountAddress) {
    throw new Error('User address does not match chain account address');
  }

  if (!isAddress(accountAddress)) {
    throw new Error('Invalid chain account address');
  }
}

interface GetSubmittedLoanApplicationsResponse {
  isError: boolean;
  errorMessage?: string;
  loanApplications?: LoanApplicationsForTable[];
}
export const getSubmittedLoanApplications = async (
  accountAddress: string
): Promise<GetSubmittedLoanApplicationsResponse> => {
  try {
    await validateRequest(accountAddress);

    const loanApplications = await dbGetSubmittedLoanApplications();

    const loanApplicationsForTable: LoanApplicationsForTable[] = loanApplications.map(loan => ({
      id: loan.id,
      creatorAddress: formatAddress(loan.account.address as Address),
      creditScoreEquifax: loan.creditScore?.[0]?.creditScoreEquifax ?? null,
      creditScoreTransUnion: loan.creditScore?.[0]?.creditScoreTransUnion ?? null,
      transactionCount: loan.debtService?.[0]?.transactionCount ?? null,
      status: loan.status,
      createdDate: loan.createdAt,
      updatedDate: loan.updatedAt,
    }));

    return {
      isError: false,
      loanApplications: loanApplicationsForTable,
    };
  } catch (error) {
    return {
      isError: true,
      errorMessage: 'Failed to fetch loan applications',
    };
  }
};

interface UpdateLoanApplicationStatusResponse {
  isError: boolean;
  errorMessage?: string;
}
export const updateLoanApplicationStatus = async (args: {
  loanApplicationId: string;
  status: LoanApplicationStatus;
}): Promise<UpdateLoanApplicationStatusResponse> => {
  try {
    const { loanApplicationId, status } = args;

    await dbUpdateLoanApplication({ loanApplicationId, loanApplication: { status } });

    if (status === LoanApplicationStatus.APPROVED) {
      await activateLoan(loanApplicationId);
    }

    revalidatePath('/approver');

    return {
      isError: false,
    };
  } catch (error) {
    return {
      isError: true,
      errorMessage: 'Failed to update loan application status',
    };
  }
};

export const getLoanAmountAction = async (loanId: string): Promise<number> => {
  const loanAmount = await getLoanAmount(loanId);
  const tokenDecimals = await getTokenDecimals();
  return Number(loanAmount) / 10 ** tokenDecimals;
};

export const getLoanRepaymentAmountAction = async (loanId: string): Promise<number> => {
  const loanRepaymentAmount = await getLoanRepaymentAmount(loanId);
  const tokenDecimals = await getTokenDecimals();
  return Number(loanRepaymentAmount) / 10 ** tokenDecimals;
};

export const getLoanRemainingMonthsAction = async (loanId: string): Promise<number> => {
  const loanRemainingMonths = await getLoanRemainingMonths(loanId);
  return Number(loanRemainingMonths);
};

export const getTokenSymbolAction = async (): Promise<string> => {
  return await getTokenSymbol();
};
