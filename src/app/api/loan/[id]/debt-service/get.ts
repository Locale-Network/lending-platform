import { NextRequest, NextResponse } from 'next/server';
import { getLoanApplication } from '@/services/db/loan-applications/borrower';
import { PlaidApi, Transaction } from 'plaid';
import { PlaidEnvironments } from 'plaid';
import { Configuration } from 'plaid';
import { getLoanAmount } from '@/services/contracts/creditTreasuryPool';

/**
 * API endpoint is called automatically at the end of Plaid Link flow after user's bank account is connected
 * The Authorization header contains the Plaid access token for transactions
 * Flow: src/app/data/loan/credit-score/page.tsx
 *
 * @route GET /api/loan/[id]/debt-service
 * @param {string} id - The loan application ID
 * @param {string} Authorization - Bearer token containing Plaid access token for transactions
 *
 * @returns {Promise<DebtServiceApiResponse>} JSON response containing:
 * - status: 'success' or 'error'
 * - message: Description of the result
 * - data: Object containing debt service data or null
 *
 * @throws {400} - When Plaid access token is missing
 * @throws {404} - When loan application is not found
 * @throws {500} - When debt service fetch fails
 */

// export interface SBA {
//   netOperatingIncome: number;
//   totalDebtService: number;
//   dscr: number;
// }

export interface DebtServiceApiResponse {
  status: 'success' | 'error';
  message: string;
  data: {
    transactions: Transaction[];
  } | null;
}

export async function GET(request: NextRequest) {
  const loanApplicationId = request.nextUrl.searchParams.get('id');
  if (!loanApplicationId) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'No loan application ID provided',
        data: null,
      },
      { status: 400 }
    );
  }

  const accessToken = request.headers.get('Authorization')?.split(' ')[1]; // Bearer token
  if (!accessToken) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'No access token provided',
        data: null,
      },
      { status: 400 }
    );
  }

  const loanApplication = await getLoanApplication({
    loanApplicationId,
  });

  if (!loanApplication) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Loan application not found',
        data: null,
      },
      { status: 404 }
    );
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

    return NextResponse.json(
      {
        status: 'success',
        message: 'Transactions retrieved successfully',
        data: { transactions, loanAmount: loanAmount.toString() },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching debt service', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Error fetching transactions',
        data: null,
      },
      { status: 500 }
    );
  }
}
