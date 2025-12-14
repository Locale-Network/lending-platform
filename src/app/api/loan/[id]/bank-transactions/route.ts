import { NextRequest, NextResponse } from 'next/server';
import prisma from '@prisma/index';
import client from '@/utils/plaid';
import { Transaction, TransactionsSyncRequest } from 'plaid';

export const dynamic = 'force-dynamic';

/**
 * GET /api/loan/[id]/bank-transactions
 * Fetches Plaid bank transactions for a specific loan application
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get loan application with Plaid access token
    const loanApplication = await prisma.loanApplication.findUnique({
      where: { id },
      select: {
        id: true,
        plaidAccessToken: true,
        plaidTransactionsCursor: true,
        accountAddress: true,
      },
    });

    if (!loanApplication) {
      return NextResponse.json(
        { error: 'Loan application not found' },
        { status: 404 }
      );
    }

    if (!loanApplication.plaidAccessToken) {
      return NextResponse.json(
        {
          transactions: [],
          message: 'No bank account connected to this loan application'
        },
        { status: 200 }
      );
    }

    // Fetch transactions from Plaid
    let cursor = loanApplication.plaidTransactionsCursor || '';
    let added: Transaction[] = [];
    let hasMore = true;
    let maxIterations = 10; // Limit iterations to prevent infinite loops

    while (hasMore && maxIterations > 0) {
      const requestPayload: TransactionsSyncRequest = {
        access_token: loanApplication.plaidAccessToken,
        cursor,
        count: 100,
      };

      try {
        const response = await client.transactionsSync(requestPayload);
        const data = response.data;

        cursor = data.next_cursor;
        added = added.concat(data.added);
        hasMore = data.has_more;
        maxIterations--;

        // If cursor is empty and no transactions, wait and retry once
        if (cursor === '' && added.length === 0 && hasMore) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      } catch (plaidError: any) {
        console.error('Plaid API error:', plaidError?.response?.data || plaidError);
        // If this is an ITEM_LOGIN_REQUIRED error, let the user know
        if (plaidError?.response?.data?.error_code === 'ITEM_LOGIN_REQUIRED') {
          return NextResponse.json(
            {
              transactions: [],
              error: 'Bank account requires re-authentication',
              requiresReauth: true
            },
            { status: 200 }
          );
        }
        throw plaidError;
      }
    }

    // Update the cursor in the database for future syncs
    if (cursor && cursor !== loanApplication.plaidTransactionsCursor) {
      await prisma.loanApplication.update({
        where: { id },
        data: { plaidTransactionsCursor: cursor },
      });
    }

    // Transform transactions for the frontend
    const formattedTransactions = added.map(tx => ({
      id: tx.transaction_id,
      date: tx.date,
      name: tx.name,
      merchant: tx.merchant_name,
      amount: tx.amount,
      currency: tx.iso_currency_code || 'USD',
      category: tx.personal_finance_category?.primary || tx.category?.[0] || 'Other',
      categoryDetail: tx.personal_finance_category?.detailed || tx.category?.join(' > ') || '',
      pending: tx.pending,
      accountId: tx.account_id,
      // Classify as income or expense based on amount sign
      // In Plaid, positive = expense, negative = income (deposits/credits)
      type: tx.amount < 0 ? 'income' : 'expense',
    }));

    // Sort by date descending (most recent first)
    formattedTransactions.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Calculate summary statistics
    const totalIncome = formattedTransactions
      .filter(tx => tx.type === 'income')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    const totalExpenses = formattedTransactions
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);

    const categoryBreakdown = formattedTransactions.reduce((acc, tx) => {
      const cat = tx.category;
      if (!acc[cat]) {
        acc[cat] = { count: 0, total: 0 };
      }
      acc[cat].count++;
      acc[cat].total += tx.amount;
      return acc;
    }, {} as Record<string, { count: number; total: number }>);

    return NextResponse.json({
      transactions: formattedTransactions,
      summary: {
        totalTransactions: formattedTransactions.length,
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        netCashFlow: Math.round((totalIncome - totalExpenses) * 100) / 100,
        categoryBreakdown,
      },
    });
  } catch (error) {
    console.error('Bank transactions API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bank transactions' },
      { status: 500 }
    );
  }
}
