'use server';
import { CreditScore, DebtService } from '@prisma/client';
import { loanApplicationFormSchema, LoanApplicationForm } from './form-schema';
import {
  initialiseLoanApplication as dbInitialiseLoanApplication,
  submitLoanApplication as dbSubmitLoanApplication,
} from '@/services/db/loan-applications/borrower';
import { validateRequest as validateBorrowerRequest } from '@/app/borrower/actions';
import { createLoan } from '@/services/contracts/simpleLoanPool';

// return loan application id
interface InitialiseLoanApplicationResponse {
  isError: boolean;
  errorMessage?: string;
  loanApplicationId?: string;
}
export async function initialiseLoanApplication(
  accountAddress: string
): Promise<InitialiseLoanApplicationResponse> {
  try {
    await validateBorrowerRequest(accountAddress);

    const loanApplication = await dbInitialiseLoanApplication(accountAddress);

    await createLoan(loanApplication.id, accountAddress, 1000, 300, 12);

    return {
      isError: false,
      loanApplicationId: loanApplication.id,
    };
  } catch (error) {
    console.error('Error initiating loan application', error);
    return {
      isError: true,
      errorMessage: 'Error initiating loan application',
    };
  }
}

export async function submitLoanApplication(args: {
  formData: LoanApplicationForm;
  accountAddress: string;
}): Promise<void> {
  const { formData, accountAddress } = args;
  await validateBorrowerRequest(accountAddress);

  if (formData.accountAddress !== accountAddress) {
    throw new Error('Unauthorized creator of loan application');
  }

  const result = loanApplicationFormSchema.safeParse(formData);

  if (!result.success) {
    throw new Error('Invalid form data');
  }

  await dbSubmitLoanApplication({
    id: formData.applicationId,
    accountAddress,
    businessInfo: {
      businessLegalName: formData.businessLegalName,
      businessAddress: formData.businessAddress,
      businessState: formData.businessState,
      businessCity: formData.businessCity,
      businessZipCode: formData.businessZipCode,
      businessWebsite: formData.businessWebsite || null,
      ein: formData.ein,
      businessFoundedYear: formData.businessFoundedYear,
      businessLegalStructure: formData.businessLegalStructure,
      businessPrimaryIndustry: formData.businessPrimaryIndustry,
      businessDescription: formData.businessDescription,
    },
    outstandingLoans: formData.outstandingLoans,
  });
}
