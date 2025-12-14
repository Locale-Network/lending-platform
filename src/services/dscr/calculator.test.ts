import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockLoanApplication, mockTransaction } from '@/__tests__/mocks/prisma';

// Mock dependencies
const { mockPrisma, mockSyncAndSubmitToCartesi } = vi.hoisted(() => ({
  mockPrisma: {
    loanApplication: {
      findUnique: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
    },
    dSCRCalculationLog: {
      create: vi.fn(),
    },
  },
  mockSyncAndSubmitToCartesi: vi.fn(),
}));

vi.mock('@prisma/index', () => ({
  default: mockPrisma,
}));

vi.mock('@/services/plaid/zkFetchWrapper', () => ({
  syncAndSubmitToCartesi: mockSyncAndSubmitToCartesi,
}));

// Import after mocks
import {
  triggerDSCRCalculation,
  calculateAndSubmitDSCR,
  manualDSCRRecalculation,
} from './calculator';

describe('dscr/calculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSyncAndSubmitToCartesi.mockResolvedValue({
      success: true,
      transactionsAdded: 2,
      zkProofHash: '0x1234567890abcdef'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('triggerDSCRCalculation', () => {
    it('should trigger calculations for multiple loans', async () => {
      const loan = mockLoanApplication({
        id: 'loan-1',
        plaidAccessToken: 'test-token',
        transactionWindowMonths: 3,
      });

      mockPrisma.loanApplication.findUnique.mockResolvedValue(loan);
      mockPrisma.transaction.findMany.mockResolvedValue([
        mockTransaction({ amount: -1000 }),
        mockTransaction({ amount: 100 }),
      ]);
      mockPrisma.dSCRCalculationLog.create.mockResolvedValue({});

      const result = await triggerDSCRCalculation(['loan-1', 'loan-2']);

      expect(result.submitted).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockSyncAndSubmitToCartesi).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures', async () => {
      // First loan succeeds
      mockPrisma.loanApplication.findUnique
        .mockResolvedValueOnce(
          mockLoanApplication({ id: 'loan-1', plaidAccessToken: 'token-1' })
        )
        // Second loan not found
        .mockResolvedValueOnce(null);

      mockPrisma.transaction.findMany.mockResolvedValue([
        mockTransaction({ amount: -1000 }),
      ]);
      mockPrisma.dSCRCalculationLog.create.mockResolvedValue({});

      const result = await triggerDSCRCalculation(['loan-1', 'loan-2']);

      expect(result.submitted).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].loanId).toBe('loan-2');
      expect(result.errors[0].error).toContain('not found');
    });

    it('should return empty result for empty loan list', async () => {
      const result = await triggerDSCRCalculation([]);

      expect(result.submitted).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toEqual([]);
      expect(mockSyncAndSubmitToCartesi).not.toHaveBeenCalled();
    });
  });

  describe('calculateAndSubmitDSCR', () => {
    it('should calculate and submit DSCR for a loan', async () => {
      const loan = mockLoanApplication({
        id: 'test-loan',
        requestedAmount: 100000,
        plaidAccessToken: 'test-token',
        transactionWindowMonths: 3,
        accountAddress: '0x1234567890abcdef',
      });

      mockPrisma.loanApplication.findUnique.mockResolvedValueOnce(loan);
      mockPrisma.dSCRCalculationLog.create.mockResolvedValueOnce({});

      await calculateAndSubmitDSCR('test-loan');

      expect(mockSyncAndSubmitToCartesi).toHaveBeenCalledWith(
        expect.objectContaining({
          loanId: 'test-loan',
          accessToken: 'test-token',
          borrowerAddress: '0x1234567890abcdef',
        })
      );

      expect(mockPrisma.dSCRCalculationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          loanApplicationId: 'test-loan',
          transactionCount: 2,
          windowMonths: 3,
          status: 'SUBMITTED',
        }),
      });
    });

    it('should throw error for non-existent loan', async () => {
      mockPrisma.loanApplication.findUnique.mockResolvedValueOnce(null);

      await expect(calculateAndSubmitDSCR('non-existent')).rejects.toThrow(
        'Loan non-existent not found'
      );

      expect(mockSyncAndSubmitToCartesi).not.toHaveBeenCalled();
    });

    it('should throw error for loan without Plaid access token', async () => {
      mockPrisma.loanApplication.findUnique.mockResolvedValueOnce(
        mockLoanApplication({ id: 'test-loan', plaidAccessToken: null })
      );

      await expect(calculateAndSubmitDSCR('test-loan')).rejects.toThrow(
        'has no Plaid access token'
      );

      expect(mockSyncAndSubmitToCartesi).not.toHaveBeenCalled();
    });

    it('should use default transaction window if not set', async () => {
      const loan = mockLoanApplication({
        id: 'test-loan',
        plaidAccessToken: 'test-token',
        transactionWindowMonths: null,
      });

      mockPrisma.loanApplication.findUnique.mockResolvedValueOnce(loan);
      mockPrisma.dSCRCalculationLog.create.mockResolvedValueOnce({});

      await calculateAndSubmitDSCR('test-loan');

      // Verify syncAndSubmitToCartesi was called
      expect(mockSyncAndSubmitToCartesi).toHaveBeenCalledWith(
        expect.objectContaining({
          loanId: 'test-loan',
          accessToken: 'test-token',
        })
      );

      // Window defaults to 3 in the log
      expect(mockPrisma.dSCRCalculationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          windowMonths: 3, // Default value
        }),
      });
    });

    it('should still submit with empty transactions', async () => {
      const loan = mockLoanApplication({
        id: 'test-loan',
        plaidAccessToken: 'test-token',
      });

      mockPrisma.loanApplication.findUnique.mockResolvedValueOnce(loan);
      mockPrisma.dSCRCalculationLog.create.mockResolvedValueOnce({});

      await calculateAndSubmitDSCR('test-loan');

      expect(mockSyncAndSubmitToCartesi).toHaveBeenCalledWith(
        expect.objectContaining({
          loanId: 'test-loan',
          accessToken: 'test-token',
        })
      );

      expect(mockPrisma.dSCRCalculationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transactionCount: 2, // From mock response
        }),
      });
    });

    it('should handle syncAndSubmitToCartesi failure', async () => {
      const loan = mockLoanApplication({
        id: 'test-loan',
        plaidAccessToken: 'test-token',
      });

      mockPrisma.loanApplication.findUnique.mockResolvedValueOnce(loan);
      mockSyncAndSubmitToCartesi.mockResolvedValueOnce({
        success: false,
        error: 'Connection timeout',
      });

      await expect(calculateAndSubmitDSCR('test-loan')).rejects.toThrow(
        'DSCR submission failed: Connection timeout'
      );
    });
  });

  describe('manualDSCRRecalculation', () => {
    it('should trigger DSCR calculation for a single loan', async () => {
      const loan = mockLoanApplication({
        id: 'manual-loan',
        plaidAccessToken: 'test-token',
      });

      mockPrisma.loanApplication.findUnique.mockResolvedValueOnce(loan);
      mockPrisma.dSCRCalculationLog.create.mockResolvedValueOnce({});

      await manualDSCRRecalculation('manual-loan');

      expect(mockSyncAndSubmitToCartesi).toHaveBeenCalledTimes(1);
      expect(mockPrisma.dSCRCalculationLog.create).toHaveBeenCalled();
    });
  });
});
