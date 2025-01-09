'use server';

import { loanApplicationFormSchema, LoanApplicationForm } from './form-schema';
import {
  initialiseLoanApplication as dbInitialiseLoanApplication,
  submitLoanApplication as dbSubmitLoanApplication,
  getLoanApplication,
} from '@/services/db/loan-applications/borrower';
import { validateRequest as validateBorrowerRequest } from '@/app/borrower/actions';
import { createLoan, getLoanAmount } from '@/services/contracts/simpleLoanPool';

import { getAllLoanApplicationsOfBorrower as dbGetAllLoanApplicationsOfBorrower } from '@/services/db/loan-applications/borrower';
import plaidClient from '@/utils/plaid';
import { LoanApplicationStatus, LoanApplication } from '@prisma/client';
import { Configuration, CountryCode, PlaidApi, PlaidEnvironments, Products } from 'plaid';
import { saveItemAccessToken as dbSaveItemAccessToken } from '@/services/db/plaid/item-access';
import { submitInput } from '@/services/cartesi';

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

    await createLoan(loanApplication.id, accountAddress, 1000000000, 300, 24);

    console.log('loan created');

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
}) {
  const { accessToken, loanApplicationId } = args;

  const loanApplication = await getLoanApplication({
    loanApplicationId,
  });

  if (!loanApplication) {
    throw new Error('Loan application not found');
  }

  try {
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

    const loanAmount = await getLoanAmount(loanApplication.id);

    await submitInput({
      loanId: loanApplication.id,
      transactions,
      loanAmount: loanAmount.toString(),
    });
  } catch (error) {
    console.error('Error submitting debt service proof', error);
  }
}
