import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockZkFetchProof, mockZkFetchProofEmpty } from '@/__tests__/mocks/reclaim';
import { mockLoanApplication, mockTransaction } from '@/__tests__/mocks/prisma';

// Mock dependencies - use vi.hoisted for variables referenced in vi.mock factories
const { mockZkFetch, mockPrisma, mockSubmitInput } = vi.hoisted(() => ({
  mockZkFetch: vi.fn(),
  mockPrisma: {
    transaction: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    loanApplication: {
      update: vi.fn(),
    },
  },
  mockSubmitInput: vi.fn(),
}));

vi.mock('server-only', () => ({}));

// Mock the js-sdk verification functions - return true for test proofs
vi.mock('@reclaimprotocol/js-sdk', () => ({
  verifyProof: vi.fn().mockResolvedValue(true),
  transformForOnchain: vi.fn().mockReturnValue({
    claimInfo: { provider: 'mock', parameters: '{}', context: '' },
    signedClaim: { claim: {}, signatures: [] },
  }),
}));

vi.mock('@reclaimprotocol/zk-fetch', () => {
  // Create a proper mock class that can be instantiated with `new`
  class MockReclaimClient {
    zkFetch = mockZkFetch;
    constructor(_appId: string, _appSecret: string) {
      // Constructor params are ignored in tests
    }
  }
  return {
    ReclaimClient: MockReclaimClient,
  };
});

vi.mock('@prisma/index', () => ({
  default: mockPrisma,
}));

vi.mock('@/services/cartesi', () => ({
  submitInput: mockSubmitInput,
}));

// Import after mocks
import {
  syncTransactionsWithZkFetch,
  syncAndSubmitToCartesi,
  isZkFetchConfigured,
  getZkFetchStatus,
} from './zkFetchWrapper';

describe('zkFetchWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set required environment variables
    process.env.RECLAIM_APP_ID = 'test_app_id';
    process.env.RECLAIM_APP_SECRET = 'test_app_secret';
    process.env.PLAID_CLIENT_ID = 'test_client_id';
    process.env.PLAID_SECRET = 'test_secret';
    process.env.PLAID_ENV = 'sandbox';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isZkFetchConfigured', () => {
    it('should return true when both credentials are set', () => {
      process.env.RECLAIM_APP_ID = 'test_id';
      process.env.RECLAIM_APP_SECRET = 'test_secret';

      expect(isZkFetchConfigured()).toBe(true);
    });

    it('should return false when RECLAIM_APP_ID is missing', () => {
      delete process.env.RECLAIM_APP_ID;
      process.env.RECLAIM_APP_SECRET = 'test_secret';

      expect(isZkFetchConfigured()).toBe(false);
    });

    it('should return false when RECLAIM_APP_SECRET is missing', () => {
      process.env.RECLAIM_APP_ID = 'test_id';
      delete process.env.RECLAIM_APP_SECRET;

      expect(isZkFetchConfigured()).toBe(false);
    });

    it('should return false when both credentials are missing', () => {
      delete process.env.RECLAIM_APP_ID;
      delete process.env.RECLAIM_APP_SECRET;

      expect(isZkFetchConfigured()).toBe(false);
    });
  });

  describe('getZkFetchStatus', () => {
    it('should return correct status when configured', () => {
      process.env.RECLAIM_APP_ID = 'test_id';
      process.env.RECLAIM_APP_SECRET = 'test_secret';
      process.env.PLAID_ENV = 'sandbox';

      const status = getZkFetchStatus();

      expect(status.configured).toBe(true);
      expect(status.appIdSet).toBe(true);
      expect(status.appSecretSet).toBe(true);
      expect(status.plaidEnv).toBe('sandbox');
    });

    it('should return correct status when not configured', () => {
      delete process.env.RECLAIM_APP_ID;
      delete process.env.RECLAIM_APP_SECRET;

      const status = getZkFetchStatus();

      expect(status.configured).toBe(false);
      expect(status.appIdSet).toBe(false);
      expect(status.appSecretSet).toBe(false);
    });

    it('should default plaidEnv to sandbox', () => {
      delete process.env.PLAID_ENV;

      const status = getZkFetchStatus();

      expect(status.plaidEnv).toBe('sandbox');
    });
  });

  describe('syncTransactionsWithZkFetch', () => {
    it('should return transactions with zkProof on success', async () => {
      mockZkFetch.mockResolvedValueOnce(mockZkFetchProof);

      const result = await syncTransactionsWithZkFetch('test-access-token');

      expect(result.success).toBe(true);
      expect(result.transactions.length).toBeGreaterThan(0);
      expect(result.zkProof).not.toBeNull();
      expect(result.proofHash).not.toBeNull();
      expect(result.proofHash).toHaveLength(64); // SHA256 hex string
    });

    it('should parse transactions correctly from zkFetch response', async () => {
      mockZkFetch.mockResolvedValueOnce(mockZkFetchProof);

      const result = await syncTransactionsWithZkFetch('test-access-token');

      expect(result.success).toBe(true);
      expect(result.transactions[0]).toHaveProperty('transaction_id');
      expect(result.transactions[0]).toHaveProperty('amount');
      expect(result.transactions[0]).toHaveProperty('date');
    });

    it('should handle cursor pagination parameter', async () => {
      mockZkFetch.mockResolvedValueOnce(mockZkFetchProof);

      await syncTransactionsWithZkFetch('test-access-token', 'cursor-123');

      // Verify zkFetch was called with cursor in the body
      const callArgs = mockZkFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.cursor).toBe('cursor-123');
    });

    it('should handle zkFetch failure gracefully', async () => {
      mockZkFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await syncTransactionsWithZkFetch('test-access-token');

      expect(result.success).toBe(false);
      expect(result.transactions).toEqual([]);
      expect(result.zkProof).toBeNull();
      expect(result.error).toBe('Network error');
    });

    it('should handle null proof response', async () => {
      mockZkFetch.mockResolvedValueOnce(null);

      const result = await syncTransactionsWithZkFetch('test-access-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to generate ZK proof');
    });

    it('should handle empty transactions array', async () => {
      mockZkFetch.mockResolvedValueOnce(mockZkFetchProofEmpty);

      const result = await syncTransactionsWithZkFetch('test-access-token');

      expect(result.success).toBe(true);
      expect(result.transactions).toEqual([]);
      expect(result.zkProof).not.toBeNull();
    });

    it('should use correct Plaid URL based on environment', async () => {
      mockZkFetch.mockResolvedValueOnce(mockZkFetchProof);
      process.env.PLAID_ENV = 'production';

      await syncTransactionsWithZkFetch('test-access-token');

      const callArgs = mockZkFetch.mock.calls[0];
      expect(callArgs[0]).toContain('production.plaid.com');
    });

    it('should use sandbox URL for sandbox environment', async () => {
      mockZkFetch.mockResolvedValueOnce(mockZkFetchProof);
      process.env.PLAID_ENV = 'sandbox';

      await syncTransactionsWithZkFetch('test-access-token');

      const callArgs = mockZkFetch.mock.calls[0];
      expect(callArgs[0]).toContain('sandbox.plaid.com');
    });
  });

  describe('syncAndSubmitToCartesi', () => {
    const defaultParams = {
      loanId: 'test-loan-id',
      accessToken: 'test-access-token',
      borrowerAddress: '0x1234567890123456789012345678901234567890',
      monthlyDebtService: 1000,
    };

    beforeEach(() => {
      // Setup default mock returns
      mockZkFetch.mockResolvedValue(mockZkFetchProof);
      mockPrisma.transaction.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.transaction.findMany.mockResolvedValue([
        mockTransaction({ amount: -1000 }), // Income
        mockTransaction({ amount: 100 }), // Expense
      ]);
      mockPrisma.loanApplication.update.mockResolvedValue(mockLoanApplication());
      mockSubmitInput.mockResolvedValue({ success: true });
    });

    it('should sync transactions and submit to Cartesi', async () => {
      const result = await syncAndSubmitToCartesi(defaultParams);

      expect(result.success).toBe(true);
      expect(result.transactionsAdded).toBeGreaterThan(0);
      expect(result.zkProofHash).not.toBeNull();
      expect(result.cartesiInputHash).not.toBeNull();
    });

    it('should store transactions in PostgreSQL', async () => {
      await syncAndSubmitToCartesi(defaultParams);

      expect(mockPrisma.transaction.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            loanApplicationId: 'test-loan-id',
            transactionId: expect.any(String),
          }),
        ]),
        skipDuplicates: true,
      });
    });

    it('should calculate DSCR correctly (negative=income, positive=expense)', async () => {
      // Setup: $1000 income, $100 expense = $900 NOI, $1000 debt service = 0.9 DSCR
      mockPrisma.transaction.findMany.mockResolvedValue([
        mockTransaction({ amount: -1000, date: new Date('2024-12-01') }),
        mockTransaction({ amount: 100, date: new Date('2024-12-15') }),
      ]);

      await syncAndSubmitToCartesi(defaultParams);

      // Verify Cartesi was called with correct DSCR calculation
      expect(mockSubmitInput).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'verify_dscr_zkfetch',
          loanId: 'test-loan-id',
          borrowerAddress: defaultParams.borrowerAddress,
          data: expect.objectContaining({
            transactionCount: 2,
            zkFetchProofHash: expect.any(String),
          }),
        })
      );
    });

    it('should update loan lastSyncedAt timestamp', async () => {
      await syncAndSubmitToCartesi(defaultParams);

      expect(mockPrisma.loanApplication.update).toHaveBeenCalledWith({
        where: { id: 'test-loan-id' },
        data: {
          lastSyncedAt: expect.any(Date),
        },
      });
    });

    it('should handle zkFetch failure', async () => {
      mockZkFetch.mockRejectedValueOnce(new Error('zkFetch failed'));

      const result = await syncAndSubmitToCartesi(defaultParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('zkFetch failed');
      expect(mockSubmitInput).not.toHaveBeenCalled();
    });

    it('should handle empty transactions array', async () => {
      mockZkFetch.mockResolvedValueOnce(mockZkFetchProofEmpty);
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      const result = await syncAndSubmitToCartesi(defaultParams);

      expect(result.success).toBe(true);
      expect(result.transactionsAdded).toBe(0);
      // Should still submit to Cartesi with 0 transactions
      expect(mockSubmitInput).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.transaction.createMany.mockRejectedValueOnce(new Error('DB error'));

      const result = await syncAndSubmitToCartesi(defaultParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB error');
    });

    it('should include zkProof data in Cartesi submission', async () => {
      await syncAndSubmitToCartesi(defaultParams);

      expect(mockSubmitInput).toHaveBeenCalledWith(
        expect.objectContaining({
          zkProof: expect.objectContaining({
            identifier: expect.any(String),
            claimData: expect.any(Object),
            signatures: expect.any(Array),
          }),
        })
      );
    });
  });
});
