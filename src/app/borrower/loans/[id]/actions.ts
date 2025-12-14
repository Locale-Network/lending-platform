'use server';

import {
  getLoanApplication as dbGetLoanApplication,
  LoanApplicationDetails,
} from '@/services/db/loan-applications/borrower';
import { validateRequest as validateBorrowerRequest } from '@/app/borrower/actions';
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
    await validateBorrowerRequest(accountAddress);
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

export async function revalidateLoanApplication(loanApplicationId: string) {
  revalidatePath(`/borrower/loans/${loanApplicationId}`);
}
