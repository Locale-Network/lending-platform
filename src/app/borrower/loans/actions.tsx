'use server';

import {
  getAllLoanApplicationsOfBorrower as dbGetAllLoanApplicationsOfBorrower,
  deleteDraftLoanApplication as dbDeleteDraftLoanApplication,
} from '@/services/db/loan-applications/borrower';
import { validateRequest as validateBorrowerRequest } from '@/app/borrower/actions';
import { LoanApplicationsForTable } from './columns';
import { revalidatePath } from 'next/cache';

interface GetLoanApplicationsResponse {
  isError: boolean;
  errorMessage?: string;
  loanApplications?: LoanApplicationsForTable[];
}

/**
 * Get all loan applications for a borrower (including drafts)
 * Drafts will now show in the main table with DRAFT status
 */
export const getLoanApplications = async (
  accountAddress: string
): Promise<GetLoanApplicationsResponse> => {
  try {
    await validateBorrowerRequest(accountAddress);
    // Get ALL loan applications including drafts
    const loans = await dbGetAllLoanApplicationsOfBorrower(accountAddress);

    const loansForTable: LoanApplicationsForTable[] = loans.map(loan => ({
      id: loan.id,
      status: loan.status,
      createdDate: loan.createdAt,
      updatedDate: loan.updatedAt,
      accountAddress,
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

interface DeleteDraftResponse {
  success: boolean;
  error?: string;
}

/**
 * Delete a draft loan application
 * Only DRAFT status applications can be deleted
 */
export const deleteDraftLoanApplication = async (
  loanApplicationId: string,
  accountAddress: string
): Promise<DeleteDraftResponse> => {
  try {
    await validateBorrowerRequest(accountAddress);

    const result = await dbDeleteDraftLoanApplication({
      loanApplicationId,
      accountAddress,
    });

    if (result.success) {
      // Revalidate the borrower pages to reflect the deletion
      revalidatePath('/borrower');
      revalidatePath('/borrower/loans');
    }

    return result;
  } catch (error: any) {
    // Re-throw Next.js redirects
    if (error?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.error('Error deleting draft loan application:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete draft application',
    };
  }
};
