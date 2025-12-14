'use server';

import { getSubmittedLoanApplicationsOfBorrower as dbGetSubmittedLoanApplicationsOfBorrower } from '@/services/db/loan-applications/borrower';
import { validateRequest as validateBorrowerRequest } from '@/app/borrower/actions';
import { LoanApplicationsForTable } from './columns';

interface GetLoanApplicationsResponse {
  isError: boolean;
  errorMessage?: string;
  loanApplications?: LoanApplicationsForTable[];
}
export const getLoanApplications = async (
  accountAddress: string
): Promise<GetLoanApplicationsResponse> => {
  try {
    await validateBorrowerRequest(accountAddress);
    const loans = await dbGetSubmittedLoanApplicationsOfBorrower(accountAddress);

    const loansForTable: LoanApplicationsForTable[] = loans.map(loan => ({
      id: loan.id,
      status: loan.status,
      createdDate: loan.createdAt,
      updatedDate: loan.updatedAt,
    }));

    return {
      isError: false,
      loanApplications: loansForTable,
    };
  } catch (error: any) {
    // Re-throw Next.js redirects - they're not actual errors
    if (error?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Error getting loan applications:', error);

    // Return empty array instead of error for better UX
    // User can still apply for new loans
    return {
      isError: false,
      loanApplications: [],
    };
  }
};
