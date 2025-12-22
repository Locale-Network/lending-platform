import plaidClient from '@/utils/plaid';
import prisma from '@prisma/index';
import {
  Transaction as PlaidTransaction,
  TransactionsSyncRequest
} from 'plaid';
import { submitInput } from '@/services/cartesi';
import crypto from 'crypto';
import { decryptField } from '@/lib/encryption';

export interface TransactionSyncResult {
  totalLoans: number;
  successful: number;
  failed: number;
  transactionsSynced: number;
  loansWithNewTransactions: string[]; // Loan IDs that had new transactions
  errors: Array<{
    loanId: string;
    error: string;
  }>;
}

export interface LoanSyncResult {
  loanId: string;
  success: boolean;
  transactionsAdded: number;
  transactionsModified: number;
  transactionsRemoved: number;
  error?: string;
}

/**
 * Sync transactions from Plaid for all active loans
 *
 * This function:
 * 1. Fetches all active loans with Plaid access tokens
 * 2. For each loan, syncs transactions using Plaid's transactionsSync API
 * 3. Stores new/modified transactions in PostgreSQL
 * 4. Updates last_synced_at timestamp
 * 5. Returns summary of sync results
 */
export async function syncTransactionsForAllLoans(): Promise<TransactionSyncResult> {
  const result: TransactionSyncResult = {
    totalLoans: 0,
    successful: 0,
    failed: 0,
    transactionsSynced: 0,
    loansWithNewTransactions: [],
    errors: []
  };

  try {
    // Fetch all active loans that have Plaid access tokens
    // Includes SUBMITTED, PENDING, APPROVED, and DISBURSED loans for ongoing DSCR monitoring
    const activeLoans = await prisma.loanApplication.findMany({
      where: {
        status: {
          in: ['SUBMITTED', 'PENDING', 'APPROVED', 'DISBURSED']
        },
        plaidAccessToken: {
          not: null
        }
      },
      select: {
        id: true,
        plaidAccessToken: true,
        plaidTransactionsCursor: true,
        transactionWindowMonths: true,
        accountAddress: true
      }
    });

    result.totalLoans = activeLoans.length;

    if (activeLoans.length === 0) {
      console.log('[Transaction Sync] No active loans with Plaid tokens found');
      return result;
    }

    console.log(`[Transaction Sync] Found ${activeLoans.length} active loans to sync`);

    // Sync transactions for each loan
    for (const loan of activeLoans) {
      try {
        // Decrypt the access token before use
        const decryptedToken = decryptField(loan.plaidAccessToken!);

        const loanResult = await syncTransactionsForLoan({
          loanId: loan.id,
          accessToken: decryptedToken,
          cursor: loan.plaidTransactionsCursor || undefined
        });

        if (loanResult.success) {
          result.successful++;
          result.transactionsSynced += loanResult.transactionsAdded;

          // Track loans with new transactions for DSCR calculation
          if (loanResult.transactionsAdded > 0 || loanResult.transactionsModified > 0) {
            result.loansWithNewTransactions.push(loanResult.loanId);
          }

          console.log(`[Transaction Sync] Loan ${loan.id}: +${loanResult.transactionsAdded} added, ~${loanResult.transactionsModified} modified, -${loanResult.transactionsRemoved} removed`);
        } else {
          result.failed++;
          result.errors.push({
            loanId: loan.id,
            error: loanResult.error || 'Unknown error'
          });

          console.error(`[Transaction Sync] Loan ${loan.id} failed:`, loanResult.error);
        }

      } catch (error) {
        result.failed++;
        result.errors.push({
          loanId: loan.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        console.error(`[Transaction Sync] Error syncing loan ${loan.id}:`, error);
      }
    }

    return result;

  } catch (error) {
    console.error('[Transaction Sync] Fatal error fetching active loans:', error);
    throw error;
  }
}

/**
 * Sync transactions from Plaid for a single loan
 *
 * Uses Plaid's transactionsSync API which provides:
 * - Cursor-based pagination
 * - Incremental updates (only new/modified/removed transactions)
 * - Automatic deduplication
 */
export async function syncTransactionsForLoan(params: {
  loanId: string;
  accessToken: string;
  cursor?: string;
}): Promise<LoanSyncResult> {
  const { loanId, accessToken, cursor } = params;

  const result: LoanSyncResult = {
    loanId,
    success: false,
    transactionsAdded: 0,
    transactionsModified: 0,
    transactionsRemoved: 0
  };

  try {
    let hasMore = true;
    let currentCursor = cursor;

    let allAdded: PlaidTransaction[] = [];
    let allModified: PlaidTransaction[] = [];
    let allRemoved: Array<{ transaction_id: string }> = [];

    // Fetch all pages of transactions
    while (hasMore) {
      const request: TransactionsSyncRequest = {
        access_token: accessToken
      };

      if (currentCursor) {
        request.cursor = currentCursor;
      }

      const response = await plaidClient.transactionsSync(request);
      const data = response.data;

      // Accumulate transactions
      allAdded = allAdded.concat(data.added);
      allModified = allModified.concat(data.modified);
      allRemoved = allRemoved.concat(data.removed);

      hasMore = data.has_more;
      currentCursor = data.next_cursor;

      // Respect rate limits
      if (hasMore) {
        await sleep(100); // 100ms delay between requests
      }
    }

    // Process added transactions
    if (allAdded.length > 0) {
      await insertTransactions(loanId, allAdded);
      result.transactionsAdded = allAdded.length;
    }

    // Process modified transactions
    if (allModified.length > 0) {
      await updateTransactions(loanId, allModified);
      result.transactionsModified = allModified.length;
    }

    // Process removed transactions
    if (allRemoved.length > 0) {
      await markTransactionsAsDeleted(loanId, allRemoved);
      result.transactionsRemoved = allRemoved.length;
    }

    // Update loan's sync metadata
    await prisma.loanApplication.update({
      where: { id: loanId },
      data: {
        plaidTransactionsCursor: currentCursor,
        lastSyncedAt: new Date()
      }
    });

    result.success = true;
    return result;

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    return result;
  }
}

/**
 * Insert new transactions into database
 */
async function insertTransactions(
  loanId: string,
  transactions: PlaidTransaction[]
): Promise<void> {
  const data = transactions.map(tx => ({
    loanApplicationId: loanId,
    transactionId: tx.transaction_id,
    accountId: tx.account_id,
    amount: tx.amount,
    currency: tx.iso_currency_code || 'USD',
    merchant: tx.merchant_name || tx.name,
    date: new Date(tx.date),
    isDeleted: false
  }));

  await prisma.transaction.createMany({
    data,
    skipDuplicates: true // Avoid duplicate key errors
  });
}

/**
 * Update modified transactions
 */
async function updateTransactions(
  loanId: string,
  transactions: PlaidTransaction[]
): Promise<void> {
  for (const tx of transactions) {
    await prisma.transaction.updateMany({
      where: {
        loanApplicationId: loanId,
        transactionId: tx.transaction_id
      },
      data: {
        amount: tx.amount,
        merchant: tx.merchant_name || tx.name,
        date: new Date(tx.date)
      }
    });
  }
}

/**
 * Mark transactions as deleted (soft delete)
 */
async function markTransactionsAsDeleted(
  loanId: string,
  removed: Array<{ transaction_id: string }>
): Promise<void> {
  const transactionIds = removed.map(r => r.transaction_id);

  await prisma.transaction.updateMany({
    where: {
      loanApplicationId: loanId,
      transactionId: {
        in: transactionIds
      }
    },
    data: {
      isDeleted: true
    }
  });
}

/**
 * Utility function to sleep (rate limiting)
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
