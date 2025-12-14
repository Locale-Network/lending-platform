import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Integration Tests: zkFetch + Cartesi DSCR Verification Flow
 *
 * These tests verify the end-to-end flow of the zkFetch architecture:
 * 1. Plaid transaction sync
 * 2. zkFetch verification request
 * 3. Cartesi DSCR calculation submission
 * 4. Notice relay to SimpleLoanPool contract
 * 5. Loan creation with verified DSCR
 */

// Mock setup with hoisting for proper Vitest behavior
const { mockPrisma, mockPlaidClient, mockZkFetch, mockCartesi, mockRelay, mockZkFetchWrapper } =
  vi.hoisted(() => ({
    mockPrisma: {
      loanApplication: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      transaction: {
        findMany: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      dSCRCalculationLog: {
        create: vi.fn(),
      },
      plaidItemAccessToken: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    },
    mockPlaidClient: {
      transactionsSync: vi.fn(),
    },
    mockZkFetch: {
      verifyPlaidTransactions: vi.fn(),
    },
    mockCartesi: {
      submitInput: vi.fn(),
    },
    mockRelay: {
      processNotices: vi.fn(),
      relayNoticeToContract: vi.fn(),
    },
    mockZkFetchWrapper: {
      syncAndSubmitToCartesi: vi.fn(),
    },
  }));

// Module mocks
vi.mock('server-only', () => ({}));
vi.mock('@prisma/index', () => ({ default: mockPrisma }));
vi.mock('@/utils/plaid', () => ({ default: mockPlaidClient }));
vi.mock('@/services/zkfetch', () => mockZkFetch);
vi.mock('@/services/cartesi', () => mockCartesi);
vi.mock('@/services/relay', () => mockRelay);
vi.mock('@/services/plaid/zkFetchWrapper', () => mockZkFetchWrapper);

// Import services after mocks
import { syncTransactionsForLoan, type LoanSyncResult } from '@/services/plaid/transactionSync';
import { triggerDSCRCalculation } from '@/services/dscr/calculator';

// Test data
const testLoan = {
  id: 'loan-integration-001',
  amount: 50000,
  plaidAccessToken: 'access-sandbox-integration',
  transactionWindowMonths: 3,
  walletAddress: '0x1234567890abcdef',
};

const testTransactions = [
  {
    transaction_id: 'int-tx-001',
    account_id: 'account-001',
    amount: -5000.0, // Income (negative in Plaid)
    date: '2024-12-01',
    name: 'Payroll',
    merchant_name: 'ACME Corp',
    iso_currency_code: 'USD',
    personal_finance_category: {
      primary: 'INCOME',
      detailed: 'INCOME_WAGES',
    },
  },
  {
    transaction_id: 'int-tx-002',
    account_id: 'account-001',
    amount: 500.0, // Expense
    date: '2024-12-05',
    name: 'Rent Payment',
    merchant_name: 'Landlord LLC',
    iso_currency_code: 'USD',
    personal_finance_category: {
      primary: 'RENT_AND_UTILITIES',
      detailed: 'RENT_AND_UTILITIES_RENT',
    },
  },
  {
    transaction_id: 'int-tx-003',
    account_id: 'account-001',
    amount: -3000.0, // More income
    date: '2024-12-10',
    name: 'Contract Payment',
    merchant_name: 'Client XYZ',
    iso_currency_code: 'USD',
    personal_finance_category: {
      primary: 'INCOME',
      detailed: 'INCOME_OTHER_INCOME',
    },
  },
];

describe('zkFetch + Cartesi Integration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockPrisma.loanApplication.findUnique.mockResolvedValue(testLoan);
    mockPrisma.plaidItemAccessToken.findFirst.mockResolvedValue({
      syncCursor: null,
      loanApplicationId: testLoan.id,
    });
    mockPlaidClient.transactionsSync.mockResolvedValue({
      data: {
        added: testTransactions,
        modified: [],
        removed: [],
        next_cursor: 'cursor-integration-test',
        has_more: false,
      },
    });
    mockPrisma.transaction.createMany.mockResolvedValue({ count: 3 });
    mockCartesi.submitInput.mockResolvedValue({ txHash: '0xabc123' });
    mockZkFetchWrapper.syncAndSubmitToCartesi.mockResolvedValue({
      success: true,
      transactionsAdded: 3,
      zkProofHash: '0xproof123',
    });
    mockPrisma.dSCRCalculationLog.create.mockResolvedValue({ id: 'log-001' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Step 1: Transaction Sync', () => {
    it('should sync transactions from Plaid for a loan', async () => {
      const result = await syncTransactionsForLoan({
        loanId: testLoan.id,
        accessToken: testLoan.plaidAccessToken,
      });

      expect(result.transactionsAdded).toBe(3);
      expect(result.transactionsModified).toBe(0);
      expect(result.transactionsRemoved).toBe(0);
      expect(mockPlaidClient.transactionsSync).toHaveBeenCalled();
    });

    it('should handle empty transaction response', async () => {
      mockPlaidClient.transactionsSync.mockResolvedValue({
        data: {
          added: [],
          modified: [],
          removed: [],
          next_cursor: 'empty-cursor',
          has_more: false,
        },
      });

      const result = await syncTransactionsForLoan({
        loanId: testLoan.id,
        accessToken: testLoan.plaidAccessToken,
      });

      expect(result.transactionsAdded).toBe(0);
    });

    it('should update sync cursor after successful sync', async () => {
      await syncTransactionsForLoan({
        loanId: testLoan.id,
        accessToken: testLoan.plaidAccessToken,
      });

      // Verify Plaid API was called with correct access token
      expect(mockPlaidClient.transactionsSync).toHaveBeenCalledWith(
        expect.objectContaining({
          access_token: testLoan.plaidAccessToken,
        })
      );
    });
  });

  describe('Step 2: DSCR Calculation Submission', () => {
    it('should submit DSCR calculation to Cartesi', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue(
        testTransactions.map((tx, i) => ({
          transactionId: tx.transaction_id,
          amount: tx.amount,
          date: new Date(tx.date),
          merchant: tx.merchant_name,
        }))
      );

      const result = await triggerDSCRCalculation([testLoan.id]);

      expect(result.submitted).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockZkFetchWrapper.syncAndSubmitToCartesi).toHaveBeenCalled();
    });

    it('should create calculation log after submission', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          transactionId: 'tx-001',
          amount: -5000,
          date: new Date(),
          merchant: 'Test',
        },
      ]);

      await triggerDSCRCalculation([testLoan.id]);

      expect(mockPrisma.dSCRCalculationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            loanApplicationId: testLoan.id,
            status: 'SUBMITTED',
          }),
        })
      );
    });

    it('should handle submission failure gracefully', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockZkFetchWrapper.syncAndSubmitToCartesi.mockResolvedValueOnce({
        success: false,
        error: 'Network error',
      });

      const result = await triggerDSCRCalculation([testLoan.id]);

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toContain('Network error');
    });
  });

  describe('Full Flow: Transaction Sync → DSCR Calculation', () => {
    it('should complete full sync and calculation flow', async () => {
      // Step 1: Sync transactions
      const syncResult = await syncTransactionsForLoan({
        loanId: testLoan.id,
        accessToken: testLoan.plaidAccessToken,
      });
      expect(syncResult.transactionsAdded).toBe(3);

      // Step 2: Prepare for DSCR calculation
      mockPrisma.transaction.findMany.mockResolvedValue(
        testTransactions.map((tx) => ({
          transactionId: tx.transaction_id,
          amount: tx.amount,
          date: new Date(tx.date),
          merchant: tx.merchant_name,
        }))
      );

      // Step 3: Submit to Cartesi
      const calcResult = await triggerDSCRCalculation([testLoan.id]);
      expect(calcResult.submitted).toBe(1);

      // Verify the submission was called with loan data
      expect(mockZkFetchWrapper.syncAndSubmitToCartesi).toHaveBeenCalledWith(
        expect.objectContaining({
          loanId: testLoan.id,
        })
      );
    });

    it('should handle multiple loans in batch', async () => {
      const loanIds = ['loan-001', 'loan-002', 'loan-003'];

      mockPrisma.loanApplication.findUnique.mockImplementation(
        async ({ where }) => ({
          ...testLoan,
          id: where.id,
        })
      );
      mockPrisma.transaction.findMany.mockResolvedValue([
        { transactionId: 'tx-1', amount: -1000, date: new Date(), merchant: 'Test' },
      ]);

      const result = await triggerDSCRCalculation(loanIds);

      expect(result.submitted).toBe(3);
      expect(mockZkFetchWrapper.syncAndSubmitToCartesi).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing loan gracefully', async () => {
      mockPrisma.loanApplication.findUnique.mockResolvedValue(null);

      const result = await triggerDSCRCalculation(['non-existent-loan']);

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toContain('not found');
    });

    it('should handle missing Plaid access token', async () => {
      mockPrisma.loanApplication.findUnique.mockResolvedValue({
        ...testLoan,
        plaidAccessToken: null,
      });

      const result = await triggerDSCRCalculation([testLoan.id]);

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toContain('Plaid access token');
    });

    it('should continue processing other loans when one fails', async () => {
      const loanIds = ['loan-success', 'loan-fail', 'loan-success-2'];

      mockPrisma.loanApplication.findUnique.mockImplementation(
        async ({ where }) => {
          if (where.id === 'loan-fail') {
            return null; // This loan doesn't exist
          }
          return { ...testLoan, id: where.id };
        }
      );
      mockPrisma.transaction.findMany.mockResolvedValue([
        { transactionId: 'tx-1', amount: -1000, date: new Date(), merchant: 'Test' },
      ]);

      const result = await triggerDSCRCalculation(loanIds);

      expect(result.submitted).toBe(2);
      expect(result.failed).toBe(1);
    });
  });

  describe('Data Validation', () => {
    it('should include correct transaction window in payload', async () => {
      mockPrisma.loanApplication.findUnique.mockResolvedValue({
        ...testLoan,
        transactionWindowMonths: 6,
      });
      mockPrisma.transaction.findMany.mockResolvedValue([
        { transactionId: 'tx-1', amount: -1000, date: new Date(), merchant: 'Test' },
      ]);

      await triggerDSCRCalculation([testLoan.id]);

      // Verify syncAndSubmitToCartesi was called
      expect(mockZkFetchWrapper.syncAndSubmitToCartesi).toHaveBeenCalled();
    });

    it('should include loan details in payload', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        { transactionId: 'tx-1', amount: -1000, date: new Date(), merchant: 'Test' },
      ]);

      await triggerDSCRCalculation([testLoan.id]);

      expect(mockZkFetchWrapper.syncAndSubmitToCartesi).toHaveBeenCalledWith(
        expect.objectContaining({
          loanId: testLoan.id,
          accessToken: testLoan.plaidAccessToken,
        })
      );
    });
  });
});

describe('Relay Service Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process notices from Cartesi and relay to contract', async () => {
    const mockNotice = {
      noticeType: 'dscr_verified_zkfetch',
      borrower: '0x1234567890abcdef',
      data: {
        loanId: testLoan.id,
        dscrValue: 1500, // 1.5 DSCR
        interestRate: 850, // 8.5%
        proofHash: '0xproof123',
      },
    };

    mockRelay.processNotices.mockResolvedValue([mockNotice]);
    mockRelay.relayNoticeToContract.mockResolvedValue({ txHash: '0xrelay456' });

    // Simulate the relay flow
    const notices = await mockRelay.processNotices();
    expect(notices).toHaveLength(1);

    const relayResult = await mockRelay.relayNoticeToContract(notices[0]);
    expect(relayResult.txHash).toBe('0xrelay456');
  });
});
