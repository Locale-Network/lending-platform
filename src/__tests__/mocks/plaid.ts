import { vi } from 'vitest';

// Mock Plaid transaction sync response
export const mockPlaidTransactionsSyncResponse = {
  data: {
    added: [
      {
        transaction_id: 'tx-001',
        account_id: 'account-001',
        amount: -500.0, // Income (negative in Plaid)
        date: '2024-12-01',
        name: 'Payroll Deposit',
        merchant_name: 'ACME Corp',
        iso_currency_code: 'USD',
        personal_finance_category: {
          primary: 'INCOME',
          detailed: 'INCOME_WAGES',
        },
      },
      {
        transaction_id: 'tx-002',
        account_id: 'account-001',
        amount: 50.0, // Expense (positive in Plaid)
        date: '2024-12-02',
        name: 'Coffee Shop',
        merchant_name: 'Starbucks',
        iso_currency_code: 'USD',
        personal_finance_category: {
          primary: 'FOOD_AND_DRINK',
          detailed: 'FOOD_AND_DRINK_COFFEE',
        },
      },
      {
        transaction_id: 'tx-003',
        account_id: 'account-001',
        amount: -1000.0, // Another income
        date: '2024-12-05',
        name: 'Client Payment',
        merchant_name: 'Client ABC',
        iso_currency_code: 'USD',
        personal_finance_category: {
          primary: 'INCOME',
          detailed: 'INCOME_OTHER_INCOME',
        },
      },
    ],
    modified: [],
    removed: [],
    next_cursor: 'cursor-abc123',
    has_more: false,
  },
};

// Mock for transactions sync with pagination
export const mockPlaidTransactionsSyncResponseWithMore = {
  data: {
    added: [
      {
        transaction_id: 'tx-page2-001',
        account_id: 'account-001',
        amount: -2000.0,
        date: '2024-11-28',
        name: 'Another Payment',
        merchant_name: 'Client XYZ',
        iso_currency_code: 'USD',
      },
    ],
    modified: [],
    removed: [],
    next_cursor: 'cursor-def456',
    has_more: true,
  },
};

// Mock Plaid client factory
export const createMockPlaidClient = () => ({
  transactionsSync: vi.fn().mockResolvedValue(mockPlaidTransactionsSyncResponse),
  transactionsGet: vi.fn().mockResolvedValue({
    data: {
      transactions: mockPlaidTransactionsSyncResponse.data.added,
      total_transactions: 3,
    },
  }),
  linkTokenCreate: vi.fn().mockResolvedValue({
    data: {
      link_token: 'link-sandbox-test-token',
      expiration: '2024-12-31T23:59:59Z',
    },
  }),
  itemPublicTokenExchange: vi.fn().mockResolvedValue({
    data: {
      access_token: 'test-access-token',
      item_id: 'test-item-id',
    },
  }),
});

// Mock Plaid webhook payloads
export const mockPlaidWebhookItemLoginRequired = {
  webhook_type: 'ITEM',
  webhook_code: 'ITEM_LOGIN_REQUIRED',
  item_id: 'test-item-id',
  error: {
    error_code: 'ITEM_LOGIN_REQUIRED',
    error_message: 'Re-authentication required',
  },
};

export const mockPlaidWebhookUserPermissionRevoked = {
  webhook_type: 'ITEM',
  webhook_code: 'USER_PERMISSION_REVOKED',
  item_id: 'test-item-id',
};

export const mockPlaidWebhookSyncUpdatesAvailable = {
  webhook_type: 'TRANSACTIONS',
  webhook_code: 'SYNC_UPDATES_AVAILABLE',
  item_id: 'test-item-id',
  initial_update_complete: true,
  historical_update_complete: true,
};

export const mockPlaidWebhookPendingExpiration = {
  webhook_type: 'ITEM',
  webhook_code: 'PENDING_EXPIRATION',
  item_id: 'test-item-id',
  consent_expiration_time: '2024-12-31T23:59:59Z',
};

// Alias exports for tests that need direct data (without the { data: ... } wrapper)
// Note: Plaid SDK returns { data: ... } but some tests may need direct access
export const mockPlaidTransactionSyncResponse = {
  added: mockPlaidTransactionsSyncResponse.data.added.slice(0, 2), // 2 transactions
  modified: [],
  removed: [],
  next_cursor: 'cursor-abc123',
  has_more: false,
};

export const mockPlaidTransactionSyncResponseEmpty = {
  added: [],
  modified: [],
  removed: [],
  next_cursor: 'empty-cursor',
  has_more: false,
};
