'use server';

import { getAllLoanApplicationsOfBorrower as dbGetAllLoanApplicationsOfBorrower } from '@/services/db/loan-applications/borrower';
import plaidClient from '@/utils/plaid';
import { LoanApplicationStatus, LoanApplication } from '@prisma/client';
import { CountryCode, Products } from 'plaid';
import { saveItemAccessToken as dbSaveItemAccessToken } from '@/services/db/plaid/item-access';

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
