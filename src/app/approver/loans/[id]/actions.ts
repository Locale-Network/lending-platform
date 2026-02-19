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
import { getLoanActive, getLoanAmount } from '@/services/contracts/creditTreasuryPool';
import { LoanApplicationStatus, Role } from '@prisma/client';
import { getSession } from '@/lib/auth/authorization';
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

/**
 * Close a fully repaid loan (ADMIN ONLY)
 *
 * Verifies on-chain that the loan is no longer active (fully repaid),
 * then transitions the database status from DISBURSED to REPAID.
 */
export const closeLoan = async (args: {
  accountAddress: string;
  loanApplicationId: string;
}): Promise<UpdateLoanApplicationStatusResponse> => {
  try {
    const { accountAddress, loanApplicationId } = args;
    await validateApproverRequest(accountAddress);

    const session = await getSession();
    if (session?.user.role !== Role.ADMIN) {
      throw new Error('Only ADMIN can close loans');
    }

    // Verify the loan is fully repaid on-chain
    const loanActive = await getLoanActive(loanApplicationId);
    const onChainAmount = await getLoanAmount(loanApplicationId);

    if (loanActive) {
      throw new Error('Loan is still active on-chain. It must be fully repaid before closing.');
    }

    if (Number(onChainAmount) === 0) {
      throw new Error('Loan does not exist on-chain.');
    }

    // Fetch the current loan to verify status
    const loan = await dbGetLoanApplication({ loanApplicationId });
    if (!loan) {
      throw new Error(`Loan application ${loanApplicationId} not found`);
    }

    if (loan.status !== LoanApplicationStatus.DISBURSED) {
      throw new Error(`Cannot close loan with status: ${loan.status}. Only DISBURSED loans can be closed.`);
    }

    // Update database status to REPAID
    await dbUpdateLoanApplication({
      loanApplicationId,
      loanApplication: { status: LoanApplicationStatus.REPAID },
    });

    revalidatePath(`/approver/loans/${loanApplicationId}`);
    revalidatePath('/approver');
    revalidatePath('/admin');

    return { isError: false };
  } catch (error) {
    return {
      isError: true,
      errorMessage: error instanceof Error ? error.message : 'Failed to close loan',
    };
  }
};
