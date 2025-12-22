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

    // Pagination parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = Math.min(parseInt(searchParams.get('perPage') || '10', 10), 50); // Max 50, default 10
    const skip = (page - 1) * perPage;

    // Get loan application with Plaid access token (check both direct field and related table)
    const loanApplication = await prisma.loanApplication.findUnique({
      where: { id },
      select: {
        id: true,
        plaidAccessToken: true,
        plaidTransactionsCursor: true,
        accountAddress: true,
        // Also get tokens from the plaid_item_access_tokens table
        plaidItemAccessToken: {
          select: {
            accessToken: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
        // Get stored transactions from DB with pagination
        transactions: {
          where: { isDeleted: false },
          orderBy: { date: 'desc' },
          skip,
          take: perPage,
        },
        // Count total transactions for pagination
        _count: {
          select: { transactions: { where: { isDeleted: false } } },
        },
      },
    });

    if (!loanApplication) {
      return NextResponse.json(
        { error: 'Loan application not found' },
        { status: 404 }
      );
    }

    // Check both the direct field and the related table for access token
    const accessToken = loanApplication.plaidAccessToken ||
      loanApplication.plaidItemAccessToken?.[0]?.accessToken;

    // If we have stored transactions, return those first
    const totalTransactionCount = loanApplication._count?.transactions || 0;

    if (loanApplication.transactions && loanApplication.transactions.length > 0) {
      // Fetch all transactions for summary calculation (without pagination)
      const allTransactions = await prisma.transaction.findMany({
        where: { loanApplicationId: id, isDeleted: false },
        select: { amount: true, merchant: true },
      });

      // Calculate summary statistics from ALL transactions
      // In Plaid: negative amounts = income, positive = expenses
      const totalIncome = allTransactions
        .filter(tx => (tx.amount || 0) < 0)
        .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0);

      const totalExpenses = allTransactions
        .filter(tx => (tx.amount || 0) > 0)
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);

      const categoryBreakdown = allTransactions.reduce((acc, tx) => {
        // Use merchant as category since we don't have a category field
        const cat = tx.merchant || 'Other';
        if (!acc[cat]) {
          acc[cat] = { count: 0, total: 0 };
        }
        acc[cat].count++;
        acc[cat].total += tx.amount || 0;
        return acc;
      }, {} as Record<string, { count: number; total: number }>);

      // Calculate pagination info
      const totalPages = Math.ceil(totalTransactionCount / perPage);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return NextResponse.json({
        transactions: loanApplication.transactions.map(tx => ({
          id: tx.transactionId || String(tx.id),
          transaction_id: tx.transactionId || String(tx.id),
          name: tx.merchant || 'Unknown',
          merchant: tx.merchant,
          amount: tx.amount,
          date: tx.date?.toISOString().split('T')[0],
          category: tx.merchant || 'Other',
          pending: false,
          type: (tx.amount || 0) < 0 ? 'income' : 'expense',
        })),
        summary: {
          totalTransactions: totalTransactionCount,
          totalIncome: Math.round(totalIncome * 100) / 100,
          totalExpenses: Math.round(totalExpenses * 100) / 100,
          netCashFlow: Math.round((totalIncome - totalExpenses) * 100) / 100,
          categoryBreakdown,
          source: 'database',
        },
        pagination: {
          page,
          perPage,
          totalPages,
          totalItems: totalTransactionCount,
          hasNextPage,
          hasPrevPage,
        },
      });
    }

    if (!accessToken) {
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
        access_token: accessToken,
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
