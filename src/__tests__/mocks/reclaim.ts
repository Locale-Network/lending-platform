import { vi } from 'vitest';

// Mock zkFetch proof structure matching Reclaim Protocol
export const mockZkFetchProof = {
  claimData: {
    provider: 'plaid-transactions',
    parameters: JSON.stringify({
      url: 'https://sandbox.plaid.com/transactions/sync',
    }),
    context: 'transaction-sync-context-123',
    identifier: 'proof-identifier-abc',
    epoch: 1,
  },
  signatures: ['0xsig1...', '0xsig2...'],
  witnesses: [
    {
      id: 'witness-1',
      url: 'https://witness1.reclaimprotocol.org',
    },
    {
      id: 'witness-2',
      url: 'https://witness2.reclaimprotocol.org',
    },
  ],
  extractedParameterValues: {
    data: JSON.stringify({
      added: [
        {
          transaction_id: 'tx-zk-001',
          account_id: 'account-001',
          amount: -1000.0,
          date: '2024-12-01',
          name: 'Client Payment',
          merchant_name: 'Big Client Inc',
          iso_currency_code: 'USD',
        },
        {
          transaction_id: 'tx-zk-002',
          account_id: 'account-001',
          amount: 100.0,
          date: '2024-12-02',
          name: 'Office Supplies',
          merchant_name: 'Staples',
          iso_currency_code: 'USD',
        },
      ],
      modified: [],
      removed: [],
      next_cursor: 'zk-cursor-123',
      has_more: false,
    }),
  },
  identifier: 'proof-identifier-123',
};

// Mock zkFetch proof with pagination
export const mockZkFetchProofWithMore = {
  ...mockZkFetchProof,
  extractedParameterValues: {
    data: JSON.stringify({
      added: [
        {
          transaction_id: 'tx-zk-page2-001',
          account_id: 'account-001',
          amount: -500.0,
          date: '2024-11-28',
          name: 'Another Payment',
          iso_currency_code: 'USD',
        },
      ],
      modified: [],
      removed: [],
      next_cursor: 'zk-cursor-456',
      has_more: true,
    }),
  },
};

// Mock zkFetch proof with empty transactions
export const mockZkFetchProofEmpty = {
  ...mockZkFetchProof,
  extractedParameterValues: {
    data: JSON.stringify({
      added: [],
      modified: [],
      removed: [],
      next_cursor: 'empty-cursor',
      has_more: false,
    }),
  },
};

// Factory to create a mock ReclaimClient
export const createMockReclaimClient = () => ({
  zkFetch: vi.fn().mockResolvedValue(mockZkFetchProof),
});

// Mock failed zkFetch
export const mockZkFetchError = new Error('zkFetch failed: Unable to verify API response');

// Create a mock ReclaimClient that fails
export const createMockReclaimClientFailing = () => ({
  zkFetch: vi.fn().mockRejectedValue(mockZkFetchError),
});
