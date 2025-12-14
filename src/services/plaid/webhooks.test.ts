import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mockPlaidWebhookItemLoginRequired,
  mockPlaidWebhookUserPermissionRevoked,
  mockPlaidWebhookSyncUpdatesAvailable,
  mockPlaidWebhookPendingExpiration,
} from '@/__tests__/mocks/plaid';

// Mock dependencies
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    plaidItemAccessToken: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    loanApplication: {
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('server-only', () => ({}));

vi.mock('@prisma/index', () => ({
  default: mockPrisma,
}));

// Import after mocks
import { handlePlaidWebhook, type PlaidWebhookPayload } from './webhooks';

describe('webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handlePlaidWebhook', () => {
    describe('ITEM webhooks', () => {
      it('should handle ITEM_LOGIN_REQUIRED webhook', async () => {
        mockPrisma.plaidItemAccessToken.findMany.mockResolvedValueOnce([
          { loanApplicationId: 'loan-1' },
          { loanApplicationId: 'loan-2' },
        ]);

        const result = await handlePlaidWebhook(
          mockPlaidWebhookItemLoginRequired as PlaidWebhookPayload
        );

        expect(result.processed).toBe(true);
        expect(result.action).toBe('handled');
        expect(result.message).toContain('2 loan(s) needing re-authentication');
      });

      it('should handle PENDING_EXPIRATION webhook', async () => {
        mockPrisma.plaidItemAccessToken.findMany.mockResolvedValueOnce([
          { loanApplicationId: 'loan-1' },
        ]);

        const result = await handlePlaidWebhook(
          mockPlaidWebhookPendingExpiration as PlaidWebhookPayload
        );

        expect(result.processed).toBe(true);
        expect(result.action).toBe('handled');
        expect(result.message).toContain('1 loan(s) needing re-authentication');
      });

      it('should handle USER_PERMISSION_REVOKED webhook', async () => {
        mockPrisma.plaidItemAccessToken.findMany.mockResolvedValueOnce([
          { loanApplicationId: 'loan-1' },
          { loanApplicationId: 'loan-2' },
        ]);
        mockPrisma.plaidItemAccessToken.deleteMany.mockResolvedValueOnce({ count: 2 });
        mockPrisma.loanApplication.updateMany.mockResolvedValueOnce({ count: 2 });

        const result = await handlePlaidWebhook(
          mockPlaidWebhookUserPermissionRevoked as PlaidWebhookPayload
        );

        expect(result.processed).toBe(true);
        expect(result.action).toBe('handled');
        expect(result.message).toBe('Cleared Plaid tokens due to permission revocation');

        // Verify tokens were deleted
        expect(mockPrisma.plaidItemAccessToken.deleteMany).toHaveBeenCalledWith({
          where: { itemId: 'test-item-id' },
        });

        // Verify loan applications were updated
        expect(mockPrisma.loanApplication.updateMany).toHaveBeenCalledWith({
          where: { id: { in: ['loan-1', 'loan-2'] } },
          data: { plaidAccessToken: null },
        });
      });

      it('should ignore ITEM webhook when no loans found', async () => {
        mockPrisma.plaidItemAccessToken.findMany.mockResolvedValueOnce([]);

        const result = await handlePlaidWebhook(
          mockPlaidWebhookItemLoginRequired as PlaidWebhookPayload
        );

        expect(result.processed).toBe(true);
        expect(result.action).toBe('ignored');
        expect(result.message).toBe('No loan applications found for this Plaid Item');
      });

      it('should ignore unknown ITEM webhook codes', async () => {
        mockPrisma.plaidItemAccessToken.findMany.mockResolvedValueOnce([
          { loanApplicationId: 'loan-1' },
        ]);

        const unknownWebhook: PlaidWebhookPayload = {
          webhook_type: 'ITEM',
          webhook_code: 'UNKNOWN_CODE',
          item_id: 'test-item-id',
        };

        const result = await handlePlaidWebhook(unknownWebhook);

        expect(result.processed).toBe(true);
        expect(result.action).toBe('ignored');
        expect(result.message).toBe('Item webhook UNKNOWN_CODE logged');
      });
    });

    describe('TRANSACTIONS webhooks', () => {
      it('should handle SYNC_UPDATES_AVAILABLE webhook', async () => {
        mockPrisma.plaidItemAccessToken.findMany.mockResolvedValueOnce([
          { loanApplicationId: 'loan-1' },
        ]);

        const result = await handlePlaidWebhook(
          mockPlaidWebhookSyncUpdatesAvailable as PlaidWebhookPayload
        );

        expect(result.processed).toBe(true);
        expect(result.action).toBe('handled');
        expect(result.message).toBe('Transaction sync available for 1 loan(s)');
        expect(result.loanApplicationId).toBe('loan-1');
      });

      it('should handle SYNC_UPDATES_AVAILABLE with no associated loans', async () => {
        mockPrisma.plaidItemAccessToken.findMany.mockResolvedValueOnce([]);

        const result = await handlePlaidWebhook(
          mockPlaidWebhookSyncUpdatesAvailable as PlaidWebhookPayload
        );

        expect(result.processed).toBe(true);
        expect(result.action).toBe('ignored');
        expect(result.message).toBe('Transactions webhook SYNC_UPDATES_AVAILABLE logged');
      });

      it('should ignore unknown TRANSACTIONS webhook codes', async () => {
        const unknownTransactionWebhook: PlaidWebhookPayload = {
          webhook_type: 'TRANSACTIONS',
          webhook_code: 'HISTORICAL_UPDATE',
          item_id: 'test-item-id',
        };

        const result = await handlePlaidWebhook(unknownTransactionWebhook);

        expect(result.processed).toBe(true);
        expect(result.action).toBe('ignored');
        expect(result.message).toBe('Transactions webhook HISTORICAL_UPDATE logged');
      });
    });

    describe('Unknown webhook types', () => {
      it('should ignore unknown webhook types', async () => {
        const unknownWebhook: PlaidWebhookPayload = {
          webhook_type: 'ASSETS',
          webhook_code: 'PRODUCT_READY',
          item_id: 'test-item-id',
        };

        const result = await handlePlaidWebhook(unknownWebhook);

        expect(result.processed).toBe(true);
        expect(result.action).toBe('ignored');
        expect(result.message).toBe('Webhook type ASSETS not handled');
      });

      it('should ignore INCOME webhook type', async () => {
        const incomeWebhook: PlaidWebhookPayload = {
          webhook_type: 'INCOME',
          webhook_code: 'INCOME_VERIFICATION',
          item_id: 'test-item-id',
        };

        const result = await handlePlaidWebhook(incomeWebhook);

        expect(result.processed).toBe(true);
        expect(result.action).toBe('ignored');
        expect(result.message).toBe('Webhook type INCOME not handled');
      });
    });
  });
});
