'use server';

import {
  getLoanApplication as dbGetLoanApplication,
  LoanApplicationDetails,
  updateLoanApplication as dbUpdateLoanApplication,
} from '@/services/db/loan-applications/approver';
import {
  validateRequest as validateApproverRequest,
  approveLoan as approverApproveLoan,
  disburseLoan as approverDisburseLoan,
} from '@/app/approver/actions';
import { LoanApplicationStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';

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

/**
 * Update loan application status (for non-approval status changes)
 * For APPROVED status, this now delegates to approveLoan()
 */
export const updateLoanApplicationStatus = async (args: {
  accountAddress: string;
  loanApplicationId: string;
  status: LoanApplicationStatus;
}): Promise<UpdateLoanApplicationStatusResponse> => {
  try {
    const { accountAddress, loanApplicationId, status } = args;
    await validateApproverRequest(accountAddress);

    // For APPROVED status, use the proper approval flow
    if (status === LoanApplicationStatus.APPROVED) {
      return approverApproveLoan({ loanApplicationId });
    }

    // For other statuses, update database directly
    await dbUpdateLoanApplication({ loanApplicationId, loanApplication: { status } });

    revalidatePath(`/approver/loans/${loanApplicationId}`);

    return {
      isError: false,
    };
  } catch (error) {
    return {
      isError: true,
      errorMessage: error instanceof Error ? error.message : 'Error updating loan application status',
    };
  }
};

/**
 * Disburse funds for an approved loan (ADMIN ONLY)
 * Re-exports from main approver actions
 */
export const disburseLoan = async (args: {
  accountAddress: string;
  loanApplicationId: string;
}): Promise<UpdateLoanApplicationStatusResponse> => {
  return approverDisburseLoan({
    loanApplicationId: args.loanApplicationId,
    accountAddress: args.accountAddress,
  });
};
