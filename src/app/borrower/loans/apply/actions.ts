'use server';

import {
  loanApplicationFormSchema,
  LoanApplicationForm,
  FundingUrgencyToTermMonths,
  FundingUrgencyType,
} from './form-schema';
import {
  initialiseLoanApplication as dbInitialiseLoanApplication,
  submitLoanApplication as dbSubmitLoanApplication,
  getLoanApplication,
  saveDraftProgress as dbSaveDraftProgress,
} from '@/services/db/loan-applications/borrower';
import { validateRequest as validateBorrowerRequest } from '@/app/borrower/actions';
import { getLoanAmount } from '@/services/contracts/creditTreasuryPool';
import { getSession } from '@/lib/auth/authorization';
import { getAllLoanApplicationsOfBorrower as dbGetAllLoanApplicationsOfBorrower } from '@/services/db/loan-applications/borrower';
import plaidClient from '@/utils/plaid';
import { LoanApplicationStatus, LoanApplication } from '@prisma/client';
import { Configuration, CountryCode, PlaidApi, PlaidEnvironments, Products } from 'plaid';
import { saveItemAccessToken as dbSaveItemAccessToken } from '@/services/db/plaid/item-access';
import { submitInput } from '@/services/cartesi';
import prisma from '@prisma/index';
import { syncAndSubmitToCartesi, isZkFetchConfigured } from '@/services/plaid/zkFetchWrapper';
import { getLendScoreForLoan } from '@/services/plaid/lendScore';

// Existing loan data type for prefilling the form
export interface ExistingLoanData {
  applicationId: string;
  poolId: string;
  businessLegalName: string;
  businessAddress: string;
  businessState: string;
  businessCity: string;
  businessZipCode: string;
  ein: string;
  businessFoundedYear: number;
  businessLegalStructure: string;
  businessWebsite: string | null;
  businessPrimaryIndustry: string;
  businessDescription: string;
  requestedLoanAmount: number | null;
  fundingUrgency: string | null;
  loanPurpose: string | null;
  estimatedCreditScore: string | null;
  hasDebtServiceProof: boolean;
  hasOutstandingLoans: boolean;
  outstandingLoans: Array<{
    lenderName: string;
    loanType: string;
    outstandingBalance: number;
    monthlyPayment: number;
    remainingMonths: number;
    annualInterestRate: number;
  }>;
}

interface GetExistingLoanApplicationResponse {
  isError: boolean;
  errorMessage?: string;
  loanData?: ExistingLoanData;
}

export async function getExistingLoanApplication(args: {
  accountAddress: string;
  loanApplicationId: string;
}): Promise<GetExistingLoanApplicationResponse> {
  try {
    const { accountAddress, loanApplicationId } = args;
    await validateBorrowerRequest(accountAddress);

    const normalizedAddress = accountAddress.toLowerCase();

    // Fetch the loan application with its relations
    const loanApplication = await prisma.loanApplication.findFirst({
      where: {
        id: loanApplicationId,
        accountAddress: normalizedAddress,
      },
      include: {
        outstandingLoans: true,
        poolLoans: {
          select: {
            poolId: true,
          },
        },
        debtService: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!loanApplication) {
      return {
        isError: true,
        errorMessage: 'Loan application not found or you do not have access',
      };
    }

    // Check if the loan can be edited (only DRAFT or ADDITIONAL_INFO_NEEDED)
    if (
      loanApplication.status !== LoanApplicationStatus.DRAFT &&
      loanApplication.status !== LoanApplicationStatus.ADDITIONAL_INFO_NEEDED
    ) {
      return {
        isError: true,
        errorMessage: `Cannot edit application with status: ${loanApplication.status}`,
      };
    }

    // Get pool ID: prefer targetPoolId (saved from form), fallback to poolLoans
    const poolId = loanApplication.targetPoolId
      || (loanApplication.poolLoans.length > 0 ? loanApplication.poolLoans[0].poolId : '');

    // Check if debt service proof exists
    const hasDebtServiceProof = loanApplication.debtService.length > 0;

    const loanData: ExistingLoanData = {
      applicationId: loanApplication.id,
      poolId,
      businessLegalName: loanApplication.businessLegalName,
      businessAddress: loanApplication.businessAddress,
      businessState: loanApplication.businessState,
      businessCity: loanApplication.businessCity,
      businessZipCode: loanApplication.businessZipCode,
      ein: loanApplication.ein,
      businessFoundedYear: loanApplication.businessFoundedYear,
      businessLegalStructure: loanApplication.businessLegalStructure,
      businessWebsite: loanApplication.businessWebsite,
      businessPrimaryIndustry: loanApplication.businessPrimaryIndustry,
      businessDescription: loanApplication.businessDescription,
      requestedLoanAmount: loanApplication.requestedAmount ? Number(loanApplication.requestedAmount) : null,
      fundingUrgency: loanApplication.fundingUrgency,
      loanPurpose: loanApplication.loanPurpose,
      estimatedCreditScore: loanApplication.estimatedCreditScore,
      hasDebtServiceProof,
      hasOutstandingLoans: loanApplication.hasOutstandingLoans,
      outstandingLoans: loanApplication.outstandingLoans.map(loan => ({
        lenderName: loan.lenderName,
        loanType: loan.loanType,
        outstandingBalance: Number(loan.outstandingBalance),
        monthlyPayment: Number(loan.monthlyPayment),
        remainingMonths: loan.remainingMonths,
        annualInterestRate: Number(loan.annualInterestRate),
      })),
    };

    return {
      isError: false,
      loanData,
    };
  } catch (error) {
    console.error('Error fetching existing loan application', error);
    return {
      isError: true,
      errorMessage: 'Error fetching loan application',
    };
  }
}

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

    console.log('loanApplication', loanApplication);

    // Note: Loan creation on the blockchain (createLoan) happens during the approval flow
    // by admins/approvers, not during application initialization by borrowers

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
    // NEW: Loan details from Step 2
    loanDetails: {
      requestedAmount: BigInt(formData.requestedLoanAmount),
      fundingUrgency: formData.fundingUrgency,
      loanPurpose: formData.loanPurpose,
      poolId: formData.poolId,
    },
    // NEW: Credit score from Step 3
    estimatedCreditScore: formData.estimatedCreditScore,
    // NEW: Terms agreement from Step 6
    agreedToTerms: formData.agreedToTerms,
    outstandingLoans: formData.outstandingLoans,
  });
}

/**
 * Save draft progress at each step (for "Save and Continue" functionality)
 * This persists form data to the database without final submission
 */
export interface SaveDraftProgressParams {
  loanApplicationId: string;
  accountAddress: string;
  step: number;
  // Step 1 fields
  businessLegalName?: string;
  businessAddress?: string;
  businessState?: string;
  businessCity?: string;
  businessZipCode?: string;
  ein?: string;
  businessFoundedYear?: number;
  businessLegalStructure?: string;
  businessWebsite?: string;
  businessPrimaryIndustry?: string;
  businessDescription?: string;
  // Step 2 fields
  poolId?: string;
  requestedLoanAmount?: number;
  fundingUrgency?: string;
  loanPurpose?: string;
  // Step 3 fields
  estimatedCreditScore?: string;
  // Step 5 fields
  hasOutstandingLoans?: boolean;
  outstandingLoans?: Array<{
    lenderName: string;
    loanType: string;
    outstandingBalance: number;
    monthlyPayment: number;
    remainingMonths: number;
    annualInterestRate: number;
  }>;
}

export async function saveDraftProgress(
  params: SaveDraftProgressParams
): Promise<{ success: boolean; error?: string }> {
  const { loanApplicationId, accountAddress, step, ...formFields } = params;

  try {
    await validateBorrowerRequest(accountAddress);

    // Build the save data based on the current step
    const saveData: Parameters<typeof dbSaveDraftProgress>[0] = {
      id: loanApplicationId,
      accountAddress,
    };

    // Step 1: Business Information
    if (step === 1) {
      saveData.businessInfo = {
        businessLegalName: formFields.businessLegalName,
        businessAddress: formFields.businessAddress,
        businessState: formFields.businessState,
        businessCity: formFields.businessCity,
        businessZipCode: formFields.businessZipCode,
        ein: formFields.ein,
        businessFoundedYear: formFields.businessFoundedYear,
        businessLegalStructure: formFields.businessLegalStructure,
        businessWebsite: formFields.businessWebsite || null,
        businessPrimaryIndustry: formFields.businessPrimaryIndustry,
        businessDescription: formFields.businessDescription,
      };
    }

    // Step 2: Loan Details
    if (step === 2) {
      saveData.loanDetails = {
        poolId: formFields.poolId,
        requestedAmount: formFields.requestedLoanAmount,
        fundingUrgency: formFields.fundingUrgency,
        loanPurpose: formFields.loanPurpose,
      };
    }

    // Step 3: Credit Score
    if (step === 3) {
      saveData.estimatedCreditScore = formFields.estimatedCreditScore;
    }

    // Step 5: Outstanding Loans
    if (step === 5) {
      saveData.hasOutstandingLoans = formFields.hasOutstandingLoans;
      saveData.outstandingLoans = formFields.outstandingLoans;
    }

    const result = await dbSaveDraftProgress(saveData);
    return result;
  } catch (error) {
    console.error('Error saving draft progress:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save progress',
    };
  }
}

interface CreateLinkTokenResponse {
  isError: boolean;
  errorMessage?: string;
  linkToken?: string;
}
export async function createLinkTokenForTransactions(
  accountAddress: string
): Promise<CreateLinkTokenResponse> {
  try {
    const response = await plaidClient.linkTokenCreate({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      user: { client_user_id: accountAddress },
      products: [Products.Transactions],
      transactions: {
        days_requested: 730,
      },
      country_codes: [CountryCode.Us],
      client_name: 'Locale Lending',
      language: 'en',
    });

    return {
      isError: false,
      linkToken: response.data.link_token,
    };
  } catch (error) {
    return {
      isError: true,
      errorMessage: 'Error creating link token',
    };
  }
}

interface PlaidPublicTokenExchangeResponse {
  isError: boolean;
  errorMessage?: string;
  accessToken?: string;
  itemId?: string;
}
export async function plaidPublicTokenExchange(
  publicToken: string
): Promise<PlaidPublicTokenExchangeResponse> {
  try {
    const response = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;
    return {
      isError: false,
      accessToken,
      itemId,
    };
  } catch (err) {
    return {
      isError: true,
      errorMessage: 'Error exchanging public token for access token',
    };
  }
}

interface GetFilteredLoanApplicationsOfBorrowerResponse {
  isError: boolean;
  errorMessage?: string;
  loanApplications?: LoanApplication[];
}
export async function getFilteredLoanApplicationsOfBorrower(
  accountAddress: string
): Promise<GetFilteredLoanApplicationsOfBorrowerResponse> {
  try {
    const loanApplications = await dbGetAllLoanApplicationsOfBorrower(accountAddress);

    const notApprovedLoanApplications = loanApplications.filter(
      loanApplication =>
        loanApplication.status !== LoanApplicationStatus.APPROVED &&
        loanApplication.status !== LoanApplicationStatus.REJECTED
    );

    return {
      isError: false,
      loanApplications: notApprovedLoanApplications,
    };
  } catch (error) {
    return { isError: true, errorMessage: 'Failed to get all loan applications of borrower' };
  }
}

export async function savePlaidItemAccessToken(args: {
  accessToken: string;
  itemId: string;
  accountAddress: string;
  loanApplicationId: string;
}) {
  const { accessToken, itemId, accountAddress, loanApplicationId } = args;
  try {
    await dbSaveItemAccessToken({
      accessToken,
      itemId,
      accountAddress,
      loanApplicationId,
    });
  } catch (error) {}
}

export async function submitDebtServiceProof(args: {
  accessToken: string;
  loanApplicationId: string;
  requestedLoanAmount?: string; // Passed from form state when available
  fundingUrgency?: string; // Passed from form state when available
}) {
  const session = await getSession();
  const accountAddress = session?.address;

  if (!accountAddress) {
    throw new Error('Unauthorized');
  }

  // Normalize address to lowercase for case-insensitive matching
  const normalizedAddress = accountAddress.toLowerCase();

  const { accessToken, loanApplicationId, requestedLoanAmount, fundingUrgency } = args;

  // verify ownership of access token and loan application by auth user
  // Note: accessToken is encrypted in DB, so we verify by loanApplicationId instead
  const [plaidTokenOwnership, loanApplicationOwnership] = await Promise.all([
    // Verify Plaid token ownership via loan application ID (tokens are encrypted in DB)
    prisma.plaidItemAccessToken.findFirst({
      where: {
        loanApplicationId: loanApplicationId,
        accountAddress: normalizedAddress,
      },
    }),

    // Verify loan application ownership
    prisma.loanApplication.findFirst({
      where: {
        id: loanApplicationId,
        accountAddress: normalizedAddress,
      },
    }),
  ]);

  if (!plaidTokenOwnership || !loanApplicationOwnership) {
    throw new Error('Unauthorized: Resource ownership verification failed');
  }

  const loanApplication = await getLoanApplication({
    loanApplicationId,
  });

  if (!loanApplication) {
    throw new Error('Loan application not found');
  }

  if (
    loanApplication.status === LoanApplicationStatus.APPROVED ||
    loanApplication.status === LoanApplicationStatus.REJECTED
  ) {
    throw new Error(`Cannot re-calculate interest rate for ${loanApplication.status} loan`);
  }

  try {
    // Use the user's requested loan amount from the application form (Step 2)
    // Priority: 1) passed from form state, 2) from database, 3) from blockchain
    let loanAmount: number;
    let termMonths: number;

    if (requestedLoanAmount && Number(requestedLoanAmount) > 0) {
      // PRIORITY 1: Use amount passed from form state (before form submission)
      loanAmount = Number(requestedLoanAmount);
      termMonths = fundingUrgency
        ? FundingUrgencyToTermMonths[fundingUrgency as FundingUrgencyType] || 24
        : 24;
      console.log(
        `[DSCR] Using passed form state: amount=$${loanAmount.toLocaleString()}, term=${termMonths} months`
      );
    } else if (loanApplication.requestedAmount) {
      // PRIORITY 2: Use values from database (after form submission)
      loanAmount = Number(loanApplication.requestedAmount);
      termMonths = loanApplication.fundingUrgency
        ? FundingUrgencyToTermMonths[loanApplication.fundingUrgency as FundingUrgencyType]
        : 24; // default to 24 months
      console.log(
        `[DSCR] Using database values: amount=$${loanAmount.toLocaleString()}, term=${termMonths} months`
      );
    } else {
      // PRIORITY 3: Legacy fallback - get loan amount from blockchain
      const loanAmountBigInt = await getLoanAmount(loanApplication.id);
      loanAmount = Number(loanAmountBigInt);
      termMonths = 24; // default
      console.log(
        `[DSCR] Using legacy blockchain values: amount=$${loanAmount.toLocaleString()}, term=${termMonths} months`
      );
    }

    // Calculate monthly debt service using standard amortization formula
    // Monthly payment = P * [r(1+r)^n] / [(1+r)^n - 1] where:
    // P = principal, r = monthly rate, n = number of payments
    const annualRate = 0.1; // 10% APR (typical small business rate)
    const monthlyRate = annualRate / 12;
    const factor = Math.pow(1 + monthlyRate, termMonths);
    const monthlyDebtService =
      monthlyRate > 0
        ? (loanAmount * monthlyRate * factor) / (factor - 1)
        : loanAmount / termMonths;

    console.log(
      `[DSCR] Monthly debt service: $${monthlyDebtService.toFixed(2)} (${annualRate * 100}% APR)`
    );

    // Use zkFetch if configured (new architecture), otherwise fall back to legacy
    if (isZkFetchConfigured()) {
      console.log('[zkFetch] Using zkFetch + Cartesi architecture for DSCR verification');

      const result = await syncAndSubmitToCartesi({
        loanId: loanApplication.id,
        accessToken,
        borrowerAddress: accountAddress,
        monthlyDebtService,
        loanAmount: BigInt(loanAmount), // Pass loan amount for Cartesi loan creation
        termMonths,
      });

      if (!result.success) {
        console.error('[zkFetch] Failed to submit DSCR proof:', result.error);
        throw new Error(result.error || 'Failed to submit DSCR proof');
      }

      console.log(
        `[zkFetch] DSCR proof submitted successfully: ` +
          `transactions=${result.transactionsAdded}, proofHash=${result.zkProofHash?.slice(0, 16)}...`
      );
    } else {
      // Legacy flow: direct Plaid + Cartesi submission (without zkFetch proof)
      console.log('[Legacy] Using direct Plaid + Cartesi submission (zkFetch not configured)');

      const configuration = new Configuration({
        basePath: PlaidEnvironments.sandbox,
        baseOptions: {
          headers: {
            'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
            'PLAID-SECRET': process.env.PLAID_SECRET,
          },
        },
      });

      const plaidClient = new PlaidApi(configuration);

      const endDate = new Date(loanApplication.createdAt);
      // start date is 12 months before the end date
      const startDate = new Date(endDate.getTime() - 12 * 30 * 24 * 60 * 60 * 1000);

      const balanceResponse = await plaidClient.accountsBalanceGet({
        access_token: accessToken,
      });

      let balance = 0;
      for (const account of balanceResponse.data.accounts) {
        balance += account.balances.available || 0;
      }

      const response = await plaidClient.transactionsGet({
        access_token: accessToken,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
      });

      const transactions = (response?.data?.transactions || []).map(t => ({
        amount: t.amount,
        account_id: t.account_id,
        iso_currency_code: t.iso_currency_code,
        date: t.date,
      }));

      if (balance > 0) {
        transactions.push({
          amount: balance,
          account_id: 'balance',
          iso_currency_code: 'USD',
          date: new Date().toISOString(),
        });
      }

      await submitInput({
        loanId: loanApplication.id,
        transactions,
        loanAmount: loanAmount.toString(),
      });
    }

    // After DSCR submission, also retrieve LendScore if available
    // LendScore provides an additional cash-flow based credit assessment
    try {
      const lendScoreResult = await getLendScoreForLoan(loanApplication.id, accessToken);
      if (lendScoreResult.success) {
        console.log(
          `[LendScore] Retrieved score for loan ${loanApplication.id}: ` +
            `score=${lendScoreResult.score}, reasons=${lendScoreResult.reasonCodes?.join(', ')}`
        );
      } else {
        // LendScore may not be available for all institutions - this is not an error
        console.log(`[LendScore] Not available for loan ${loanApplication.id}: ${lendScoreResult.error}`);
      }
    } catch (lendScoreError) {
      // Don't fail the overall submission if LendScore retrieval fails
      console.error('[LendScore] Error retrieving LendScore:', lendScoreError);
    }
  } catch (error) {
    console.error('Error submitting debt service proof', error);
  }
}

interface DeleteDraftResponse {
  success: boolean;
  error?: string;
}

/**
 * Delete a draft loan application from the application form
 */
export async function deleteDraftApplication(
  loanApplicationId: string,
  accountAddress: string
): Promise<DeleteDraftResponse> {
  try {
    await validateBorrowerRequest(accountAddress);
    const normalizedAddress = accountAddress.toLowerCase();

    // Verify the loan exists, belongs to this borrower, and is in DRAFT status
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
      return { success: false, error: 'Unauthorized' };
    }

    if (loanApplication.status !== LoanApplicationStatus.DRAFT) {
      return { success: false, error: 'Only draft applications can be deleted' };
    }

    // Delete associated records first, then the loan application
    await prisma.$transaction(async (tx) => {
      await tx.outstandingLoan.deleteMany({
        where: { loanApplicationId },
      });
      await tx.plaidItemAccessToken.deleteMany({
        where: { loanApplicationId },
      });
      await tx.loanApplication.delete({
        where: { id: loanApplicationId },
      });
    });

    return { success: true };
  } catch (error) {
    console.error('Error deleting draft application:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete draft',
    };
  }
}
