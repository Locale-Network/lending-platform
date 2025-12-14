import 'server-only';

import prisma from '@prisma/index';
import {
  Account,
  LoanApplication,
  LoanApplicationStatus,
  OutstandingLoan,
  DebtService,
  CreditScore,
} from '@prisma/client';

export type BusinessInfo = Pick<
  LoanApplication,
  | 'businessLegalName'
  | 'businessAddress'
  | 'businessState'
  | 'businessCity'
  | 'businessZipCode'
  | 'ein'
  | 'businessFoundedYear'
  | 'businessLegalStructure'
  | 'businessWebsite'
  | 'businessPrimaryIndustry'
  | 'businessDescription'
>;

export type LoanApplicationDetails = LoanApplication & {
  account: Account;
  outstandingLoans: OutstandingLoan[];
  debtService: DebtService[];
  creditScore: CreditScore[];
};

// DRAFT MODE
export const initialiseLoanApplication = async (
  accountAddress: string
): Promise<LoanApplication> => {
  // Normalize address to lowercase for case-insensitive matching
  // EVM addresses are case-insensitive but Prisma connect is case-sensitive
  const normalizedAddress = accountAddress.toLowerCase();

  const result = await prisma.loanApplication.create({
    data: {
      account: {
        connect: {
          address: normalizedAddress,
        },
      },
      businessLegalName: '',
      businessAddress: '',
      businessState: '',
      businessCity: '',
      businessZipCode: '',
      ein: '',
      businessFoundedYear: 0,
      businessLegalStructure: '',
      businessWebsite: '',
      businessPrimaryIndustry: '',
      businessDescription: '',
    },
  });
  return result;
};

export const getLoanApplication = async (args: {
  loanApplicationId: string;
}): Promise<LoanApplicationDetails | null> => {
  const { loanApplicationId } = args;
  const result = await prisma.loanApplication.findUnique({
    where: { id: loanApplicationId },
    include: {
      account: true,
      outstandingLoans: true,
      debtService: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
      creditScore: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });
  return result;
};

export const getSubmittedLoanApplicationsOfBorrower = async (
  accountAddress: string
): Promise<LoanApplication[]> => {
  // Normalize address to lowercase for case-insensitive matching
  const normalizedAddress = accountAddress.toLowerCase();

  const result = await prisma.loanApplication.findMany({
    where: {
      accountAddress: normalizedAddress,
      isSubmitted: true,
      status: {
        not: LoanApplicationStatus.DRAFT,
      },
    },
    orderBy: [{ createdAt: 'desc' }, { updatedAt: 'desc' }],
  });
  return result;
};

export const getAllLoanApplicationsOfBorrower = async (
  accountAddress: string
): Promise<LoanApplication[]> => {
  // Normalize address to lowercase for case-insensitive matching
  const normalizedAddress = accountAddress.toLowerCase();

  const result = await prisma.loanApplication.findMany({
    where: { accountAddress: normalizedAddress },
    orderBy: [{ createdAt: 'desc' }],
  });
  return result;
};

// Loan details from Step 2 of the application form
export type LoanDetails = {
  requestedAmount: bigint;
  fundingUrgency: string;
  loanPurpose: string;
};

// PENDING MODE
export const submitLoanApplication = async (data: {
  id: string;
  accountAddress: string;
  businessInfo: BusinessInfo;
  // NEW: Loan details from Step 2
  loanDetails?: LoanDetails;
  // NEW: Credit score from Step 3
  estimatedCreditScore?: string;
  // NEW: Terms agreement from Step 6
  agreedToTerms?: boolean;
  outstandingLoans: Pick<
    OutstandingLoan,
    | 'annualInterestRate'
    | 'outstandingBalance'
    | 'monthlyPayment'
    | 'remainingMonths'
    | 'lenderName'
    | 'loanType'
  >[];
}): Promise<any> => {
  const { id, businessInfo, loanDetails, estimatedCreditScore, agreedToTerms, outstandingLoans } =
    data;

  const result = await prisma.loanApplication.update({
    where: {
      id,
    },
    data: {
      ...businessInfo,
      // NEW: Loan details from form Step 2
      ...(loanDetails && {
        requestedAmount: loanDetails.requestedAmount,
        fundingUrgency: loanDetails.fundingUrgency,
        loanPurpose: loanDetails.loanPurpose,
      }),
      // NEW: Credit score from form Step 3
      ...(estimatedCreditScore && { estimatedCreditScore }),
      // NEW: Terms agreement from form Step 6
      ...(agreedToTerms !== undefined && {
        agreedToTerms,
        agreedToTermsAt: agreedToTerms ? new Date() : null,
      }),
      hasOutstandingLoans: outstandingLoans.length > 0,
      outstandingLoans: {
        createMany: {
          data: outstandingLoans.map(outstandingLoan => ({
            ...outstandingLoan,
          })),
        },
      },
      isSubmitted: true,
      status: LoanApplicationStatus.PENDING,
    },
  });

  return result;
};
