import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mockPlaidTransactionSyncResponse,
  mockPlaidTransactionSyncResponseEmpty,
} from '@/__tests__/mocks/plaid';
import { mockLoanApplication, mockTransaction } from '@/__tests__/mocks/prisma';

// Mock dependencies - use vi.hoisted for variables referenced in vi.mock factories
const { mockPlaidClient, mockPrisma } = vi.hoisted(() => ({
  mockPlaidClient: {
    transactionsSync: vi.fn(),
  },
  mockPrisma: {
    loanApplication: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/utils/plaid', () => ({
  default: mockPlaidClient,
}));

vi.mock('@prisma/index', () => ({
  default: mockPrisma,
}));

vi.mock('@/services/cartesi', () => ({
  submitInput: vi.fn().mockResolvedValue({ success: true }),
}));

// Import after mocks
import {
  syncTransactionsForAllLoans,
  syncTransactionsForLoan,
} from './transactionSync';

describe('transactionSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('syncTransactionsForAllLoans', () => {
    it('should sync transactions for all active loans with Plaid tokens', async () => {
      // Setup mock loans
      mockPrisma.loanApplication.findMany.mockResolvedValueOnce([
        {
          id: 'loan-1',
          plaidAccessToken: 'access-token-1',
          plaidTransactionsCursor: null,
          transactionWindowMonths: 3,
        },
        {
          id: 'loan-2',
          plaidAccessToken: 'access-token-2',
          plaidTransactionsCursor: 'cursor-123',
          transactionWindowMonths: 6,
        },
      ]);

      // Mock Plaid responses for each loan
      mockPlaidClient.transactionsSync
        .mockResolvedValueOnce({ data: mockPlaidTransactionSyncResponse })
        .mockResolvedValueOnce({ data: mockPlaidTransactionSyncResponse });

      mockPrisma.transaction.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.loanApplication.update.mockResolvedValue(mockLoanApplication());

      const result = await syncTransactionsForAllLoans();

      expect(result.totalLoans).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockPlaidClient.transactionsSync).toHaveBeenCalledTimes(2);
    });

    it('should return empty result when no active loans found', async () => {
      mockPrisma.loanApplication.findMany.mockResolvedValueOnce([]);

      const result = await syncTransactionsForAllLoans();

      expect(result.totalLoans).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockPlaidClient.transactionsSync).not.toHaveBeenCalled();
    });

    it('should track loans with new transactions', async () => {
      mockPrisma.loanApplication.findMany.mockResolvedValueOnce([
        {
          id: 'loan-with-transactions',
          plaidAccessToken: 'access-token',
          plaidTransactionsCursor: null,
          transactionWindowMonths: 3,
        },
      ]);

      mockPlaidClient.transactionsSync.mockResolvedValueOnce({
        data: mockPlaidTransactionSyncResponse,
      });

      mockPrisma.transaction.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.loanApplication.update.mockResolvedValue(mockLoanApplication());

      const result = await syncTransactionsForAllLoans();

      expect(result.loansWithNewTransactions).toContain('loan-with-transactions');
    });

    it('should handle individual loan sync failures gracefully', async () => {
      mockPrisma.loanApplication.findMany.mockResolvedValueOnce([
        {
          id: 'loan-success',
          plaidAccessToken: 'access-token-1',
          plaidTransactionsCursor: null,
          transactionWindowMonths: 3,
        },
        {
          id: 'loan-fail',
          plaidAccessToken: 'access-token-2',
          plaidTransactionsCursor: null,
          transactionWindowMonths: 3,
        },
      ]);

      // First loan succeeds, second fails
      mockPlaidClient.transactionsSync
        .mockResolvedValueOnce({ data: mockPlaidTransactionSyncResponseEmpty })
        .mockRejectedValueOnce(new Error('Plaid API error'));

      mockPrisma.loanApplication.update.mockResolvedValue(mockLoanApplication());

      const result = await syncTransactionsForAllLoans();

      expect(result.totalLoans).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].loanId).toBe('loan-fail');
      expect(result.errors[0].error).toBe('Plaid API error');
    });
  });

  describe('syncTransactionsForLoan', () => {
    it('should sync transactions successfully', async () => {
      mockPlaidClient.transactionsSync.mockResolvedValueOnce({
        data: mockPlaidTransactionSyncResponse,
      });

      mockPrisma.transaction.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.loanApplication.update.mockResolvedValue(mockLoanApplication());

      const result = await syncTransactionsForLoan({
        loanId: 'test-loan-id',
        accessToken: 'test-access-token',
      });

      expect(result.success).toBe(true);
      expect(result.transactionsAdded).toBe(2);
      expect(mockPrisma.transaction.createMany).toHaveBeenCalled();
      expect(mockPrisma.loanApplication.update).toHaveBeenCalledWith({
        where: { id: 'test-loan-id' },
        data: expect.objectContaining({
          lastSyncedAt: expect.any(Date),
        }),
      });
    });

    it('should use cursor for incremental sync', async () => {
      mockPlaidClient.transactionsSync.mockResolvedValueOnce({
        data: mockPlaidTransactionSyncResponseEmpty,
      });

      mockPrisma.loanApplication.update.mockResolvedValue(mockLoanApplication());

      await syncTransactionsForLoan({
        loanId: 'test-loan-id',
        accessToken: 'test-access-token',
        cursor: 'existing-cursor',
      });

      expect(mockPlaidClient.transactionsSync).toHaveBeenCalledWith({
        access_token: 'test-access-token',
        cursor: 'existing-cursor',
      });
    });

    it('should handle pagination with has_more', async () => {
      // First page has more
      mockPlaidClient.transactionsSync.mockResolvedValueOnce({
        data: {
          ...mockPlaidTransactionSyncResponse,
          has_more: true,
          next_cursor: 'cursor-page-2',
        },
      });

      // Second page is final
      mockPlaidClient.transactionsSync.mockResolvedValueOnce({
        data: {
          ...mockPlaidTransactionSyncResponse,
          has_more: false,
          next_cursor: 'final-cursor',
        },
      });

      mockPrisma.transaction.createMany.mockResolvedValue({ count: 4 });
      mockPrisma.loanApplication.update.mockResolvedValue(mockLoanApplication());

      const result = await syncTransactionsForLoan({
        loanId: 'test-loan-id',
        accessToken: 'test-access-token',
      });

      expect(result.success).toBe(true);
      expect(result.transactionsAdded).toBe(4); // 2 from each page
      expect(mockPlaidClient.transactionsSync).toHaveBeenCalledTimes(2);
    });

    it('should handle modified transactions', async () => {
      mockPlaidClient.transactionsSync.mockResolvedValueOnce({
        data: {
          added: [],
          modified: [
            {
              transaction_id: 'tx-modified',
              account_id: 'acc-1',
              amount: 150,
              date: '2024-12-01',
              name: 'Updated Store',
              merchant_name: 'Updated Merchant',
            },
          ],
          removed: [],
          has_more: false,
          next_cursor: 'cursor',
        },
      });

      mockPrisma.transaction.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.loanApplication.update.mockResolvedValue(mockLoanApplication());

      const result = await syncTransactionsForLoan({
        loanId: 'test-loan-id',
        accessToken: 'test-access-token',
      });

      expect(result.success).toBe(true);
      expect(result.transactionsModified).toBe(1);
      expect(mockPrisma.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          loanApplicationId: 'test-loan-id',
          transactionId: 'tx-modified',
        },
        data: expect.objectContaining({
          amount: 150,
        }),
      });
    });

    it('should handle removed transactions with soft delete', async () => {
      mockPlaidClient.transactionsSync.mockResolvedValueOnce({
        data: {
          added: [],
          modified: [],
          removed: [{ transaction_id: 'tx-removed-1' }, { transaction_id: 'tx-removed-2' }],
          has_more: false,
          next_cursor: 'cursor',
        },
      });

      mockPrisma.transaction.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.loanApplication.update.mockResolvedValue(mockLoanApplication());

      const result = await syncTransactionsForLoan({
        loanId: 'test-loan-id',
        accessToken: 'test-access-token',
      });

      expect(result.success).toBe(true);
      expect(result.transactionsRemoved).toBe(2);
      expect(mockPrisma.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          loanApplicationId: 'test-loan-id',
          transactionId: {
            in: ['tx-removed-1', 'tx-removed-2'],
          },
        },
        data: {
          isDeleted: true,
        },
      });
    });

    it('should handle empty sync response', async () => {
      mockPlaidClient.transactionsSync.mockResolvedValueOnce({
        data: mockPlaidTransactionSyncResponseEmpty,
      });

      mockPrisma.loanApplication.update.mockResolvedValue(mockLoanApplication());

      const result = await syncTransactionsForLoan({
        loanId: 'test-loan-id',
        accessToken: 'test-access-token',
      });

      expect(result.success).toBe(true);
      expect(result.transactionsAdded).toBe(0);
      expect(result.transactionsModified).toBe(0);
      expect(result.transactionsRemoved).toBe(0);
      expect(mockPrisma.transaction.createMany).not.toHaveBeenCalled();
    });

    it('should handle Plaid API errors', async () => {
      mockPlaidClient.transactionsSync.mockRejectedValueOnce(
        new Error('Invalid access token')
      );

      const result = await syncTransactionsForLoan({
        loanId: 'test-loan-id',
        accessToken: 'invalid-token',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid access token');
    });

    it('should update cursor after successful sync', async () => {
      const newCursor = 'new-cursor-abc123';

      mockPlaidClient.transactionsSync.mockResolvedValueOnce({
        data: {
          ...mockPlaidTransactionSyncResponseEmpty,
          next_cursor: newCursor,
        },
      });

      mockPrisma.loanApplication.update.mockResolvedValue(mockLoanApplication());

      await syncTransactionsForLoan({
        loanId: 'test-loan-id',
        accessToken: 'test-access-token',
      });

      expect(mockPrisma.loanApplication.update).toHaveBeenCalledWith({
        where: { id: 'test-loan-id' },
        data: {
          plaidTransactionsCursor: newCursor,
          lastSyncedAt: expect.any(Date),
        },
      });
    });
  });
});
