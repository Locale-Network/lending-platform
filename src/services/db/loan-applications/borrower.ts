import 'server-only';

import prisma from '@prisma/index';
import {
  Account,
  LoanApplication,
  LoanApplicationStatus,
  OutstandingLoan,
  DebtService,
  CreditScore,
  Prisma,
} from '@prisma/client';
import { USDC_UNIT } from '@/lib/constants/business';

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
  /** Whether this loan has a linked Plaid bank account for ACH payments */
  hasBankLinked: boolean;
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
      plaidItemAccessToken: {
        take: 1,
      },
    },
  });

  if (!result) {
    return null;
  }

  // Compute hasBankLinked from Plaid token presence
  const { plaidItemAccessToken, ...loanData } = result;
  return {
    ...loanData,
    hasBankLinked: plaidItemAccessToken.length > 0,
  };
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

export const getDraftLoanApplicationsOfBorrower = async (
  accountAddress: string
): Promise<LoanApplication[]> => {
  // Normalize address to lowercase for case-insensitive matching
  const normalizedAddress = accountAddress.toLowerCase();

  const result = await prisma.loanApplication.findMany({
    where: {
      accountAddress: normalizedAddress,
      status: LoanApplicationStatus.DRAFT,
    },
    orderBy: [{ updatedAt: 'desc' }],
  });
  return result;
};

/**
 * Delete a draft loan application
 * Only DRAFT status applications can be deleted by the borrower
 */
export const deleteDraftLoanApplication = async (args: {
  loanApplicationId: string;
  accountAddress: string;
}): Promise<{ success: boolean; error?: string }> => {
  const { loanApplicationId, accountAddress } = args;
  const normalizedAddress = accountAddress.toLowerCase();

  // First, verify the loan exists, belongs to this borrower, and is in DRAFT status
  const loanApplication = await prisma.loanApplication.findUnique({
    where: { id: loanApplicationId },
    select: {
      id: true,
      accountAddress: true,
      status: true,
    },
  });

  if (!loanApplication) {
    return { success: false, error: 'Loan application not found' };
  }

  if (loanApplication.accountAddress.toLowerCase() !== normalizedAddress) {
    return { success: false, error: 'Unauthorized: This loan application belongs to a different user' };
  }

  if (loanApplication.status !== LoanApplicationStatus.DRAFT) {
    return { success: false, error: 'Only draft applications can be deleted' };
  }

  // Delete associated records first (if any), then the loan application
  await prisma.$transaction(async (tx) => {
    // Delete outstanding loans associated with this application
    await tx.outstandingLoan.deleteMany({
      where: { loanApplicationId },
    });

    // Delete any Plaid item access tokens
    await tx.plaidItemAccessToken.deleteMany({
      where: { loanApplicationId },
    });

    // Delete the loan application
    await tx.loanApplication.delete({
      where: { id: loanApplicationId },
    });
  });

  return { success: true };
};

// Loan details from Step 2 of the application form
export type LoanDetails = {
  requestedAmount: bigint;
  fundingUrgency: string;
  loanPurpose: string;
  poolId?: string;
};

/**
 * Save draft loan application progress (for "Save and Continue" functionality)
 * This allows borrowers to save their progress at each step without final submission
 */
export const saveDraftProgress = async (data: {
  id: string;
  accountAddress: string;
  // Step 1: Business Info
  businessInfo?: Partial<BusinessInfo>;
  // Step 2: Loan Details (includes pool selection)
  loanDetails?: {
    requestedAmount?: number;
    fundingUrgency?: string;
    loanPurpose?: string;
    poolId?: string;
  };
  // Step 3: Credit Score
  estimatedCreditScore?: string;
  // Step 5: Outstanding Loans
  hasOutstandingLoans?: boolean;
  outstandingLoans?: Array<{
    lenderName: string;
    loanType: string;
    outstandingBalance: number;
    monthlyPayment: number;
    remainingMonths: number;
    annualInterestRate: number;
  }>;
}): Promise<{ success: boolean; error?: string }> => {
  const { id, accountAddress, businessInfo, loanDetails, estimatedCreditScore, hasOutstandingLoans, outstandingLoans } = data;
  const normalizedAddress = accountAddress.toLowerCase();

  try {
    // Verify ownership and draft status
    const loanApplication = await prisma.loanApplication.findUnique({
      where: { id },
      select: { accountAddress: true, status: true },
    });

    if (!loanApplication) {
      return { success: false, error: 'Loan application not found' };
    }

    if (loanApplication.accountAddress.toLowerCase() !== normalizedAddress) {
      return { success: false, error: 'Unauthorized' };
    }

    if (
      loanApplication.status !== LoanApplicationStatus.DRAFT &&
      loanApplication.status !== LoanApplicationStatus.ADDITIONAL_INFO_NEEDED
    ) {
      return { success: false, error: 'Can only save progress on draft or revision applications' };
    }

    // Build typed update data
    const updateData: Prisma.LoanApplicationUncheckedUpdateInput = {};

    // Step 1: Business Info
    if (businessInfo) {
      if (businessInfo.businessLegalName !== undefined) updateData.businessLegalName = businessInfo.businessLegalName;
      if (businessInfo.businessAddress !== undefined) updateData.businessAddress = businessInfo.businessAddress;
      if (businessInfo.businessState !== undefined) updateData.businessState = businessInfo.businessState;
      if (businessInfo.businessCity !== undefined) updateData.businessCity = businessInfo.businessCity;
      if (businessInfo.businessZipCode !== undefined) updateData.businessZipCode = businessInfo.businessZipCode;
      if (businessInfo.ein !== undefined) updateData.ein = businessInfo.ein;
      if (businessInfo.businessFoundedYear !== undefined) updateData.businessFoundedYear = businessInfo.businessFoundedYear;
      if (businessInfo.businessLegalStructure !== undefined) updateData.businessLegalStructure = businessInfo.businessLegalStructure;
      if (businessInfo.businessWebsite !== undefined) updateData.businessWebsite = businessInfo.businessWebsite;
      if (businessInfo.businessPrimaryIndustry !== undefined) updateData.businessPrimaryIndustry = businessInfo.businessPrimaryIndustry;
      if (businessInfo.businessDescription !== undefined) updateData.businessDescription = businessInfo.businessDescription;
    }

    // Step 2: Loan Details
    if (loanDetails) {
      if (loanDetails.requestedAmount !== undefined) {
        updateData.requestedAmount = BigInt(loanDetails.requestedAmount);
        updateData.loanAmount = BigInt(loanDetails.requestedAmount) * USDC_UNIT;
      }
      if (loanDetails.fundingUrgency !== undefined) updateData.fundingUrgency = loanDetails.fundingUrgency;
      if (loanDetails.loanPurpose !== undefined) updateData.loanPurpose = loanDetails.loanPurpose;
      if (loanDetails.poolId !== undefined) updateData.targetPoolId = loanDetails.poolId || null;
    }

    // Step 3: Credit Score
    if (estimatedCreditScore !== undefined) {
      updateData.estimatedCreditScore = estimatedCreditScore;
    }

    // Step 5: Outstanding Loans
    if (hasOutstandingLoans !== undefined) {
      updateData.hasOutstandingLoans = hasOutstandingLoans;
    }

    // Update the loan application
    await prisma.$transaction(async (tx) => {
      await tx.loanApplication.update({
        where: { id },
        data: updateData,
      });

      // Handle outstanding loans if provided
      if (outstandingLoans !== undefined) {
        // Delete existing and replace with new
        await tx.outstandingLoan.deleteMany({
          where: { loanApplicationId: id },
        });

        if (outstandingLoans.length > 0) {
          await tx.outstandingLoan.createMany({
            data: outstandingLoans.map(loan => ({
              loanApplicationId: id,
              lenderName: loan.lenderName,
              loanType: loan.loanType,
              outstandingBalance: loan.outstandingBalance,
              monthlyPayment: loan.monthlyPayment,
              remainingMonths: loan.remainingMonths,
              annualInterestRate: loan.annualInterestRate,
            })),
          });
        }
      }

      // Note: Pool selection is stored in form state during draft
      // PoolLoan records are only created when the loan is actually funded
      // The poolId from the form is used during final submission/approval
    });

    return { success: true };
  } catch (error) {
    console.error('Error saving draft progress:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save progress',
    };
  }
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
        targetPoolId: loanDetails.poolId || null,
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
