'use server';

import {
  validateRequest as validateApproverRequest,
  approveLoan as approverApproveLoan,
  disburseLoan as approverDisburseLoan,
} from '@/app/approver/actions';
import {
  updateLoanApplication as dbUpdateLoanApplication,
} from '@/services/db/loan-applications/approver';
import { LoanApplicationStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';

interface UpdateLoanApplicationStatusResponse {
  isError: boolean;
  errorMessage?: string;
}

/**
 * Update loan application status (for non-approval status changes)
 * For APPROVED status, this delegates to approveLoan()
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

    revalidatePath(`/admin/loans/${loanApplicationId}`);

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

/**
 * Request revision with a note explaining what additional info is needed
 */
export const requestRevision = async (args: {
  accountAddress: string;
  loanApplicationId: string;
  revisionNote: string;
}): Promise<UpdateLoanApplicationStatusResponse> => {
  try {
    const { accountAddress, loanApplicationId, revisionNote } = args;
    await validateApproverRequest(accountAddress);

    // Update status and add revision note
    await dbUpdateLoanApplication({
      loanApplicationId,
      loanApplication: {
        status: LoanApplicationStatus.ADDITIONAL_INFO_NEEDED,
        revisionNote,
      },
    });

    revalidatePath(`/admin/loans/${loanApplicationId}`);

    return {
      isError: false,
    };
  } catch (error) {
    return {
      isError: true,
      errorMessage: error instanceof Error ? error.message : 'Error requesting revision',
    };
  }
};
