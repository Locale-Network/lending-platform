'use server';

import {
  getLoanApplication as dbGetLoanApplication,
  LoanApplicationDetails,
  updateLoanApplication as dbUpdateLoanApplication,
} from '@/services/db/loan-applications/approver';
import { validateRequest as validateApproverRequest } from '@/app/approver/actions';
import { LoanApplicationStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { activateLoan } from '@/services/contracts/simpleLoanPool';

interface GetLoanApplicationResponse {
  isError: boolean;
  errorMessage?: string;
  loanApplication?: LoanApplicationDetails | null;
}

export async function getLoanApplication({
  accountAddress,
  loanApplicationId,
}: {
  accountAddress: string;
  loanApplicationId: string;
}): Promise<GetLoanApplicationResponse> {
  try {
    await validateApproverRequest(accountAddress);
    const loanApplication = await dbGetLoanApplication({ loanApplicationId });

    return {
      isError: false,
      loanApplication,
    };
  } catch (error) {
    return {
      isError: true,
      errorMessage: 'Error fetching loan application',
    };
  }
}

interface UpdateLoanApplicationStatusResponse {
  isError: boolean;
  errorMessage?: string;
}

export const updateLoanApplicationStatus = async (args: {
  accountAddress: string;
  loanApplicationId: string;
  status: LoanApplicationStatus;
}): Promise<UpdateLoanApplicationStatusResponse> => {
  try {
    const { accountAddress, loanApplicationId, status } = args;
    await validateApproverRequest(accountAddress);
    await dbUpdateLoanApplication({ loanApplicationId, loanApplication: { status } });

    if (status === LoanApplicationStatus.APPROVED) {
      await activateLoan(loanApplicationId);
    }

    revalidatePath(`/approver/loans/${loanApplicationId}`);

    return {
      isError: false,
    };
  } catch (error) {
    return {
      isError: true,
      errorMessage: 'Error updating loan application status',
    };
  }
};
