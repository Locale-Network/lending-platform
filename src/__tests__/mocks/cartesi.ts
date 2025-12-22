import { vi } from 'vitest';

// Mock Cartesi notice structure - matches DscrVerifiedNotice interface from relay/index.ts
export const mockCartesiNotice = {
  index: 0,
  input: { index: 0, epoch: { index: 0 } },
  payload:
    '0x' +
    Buffer.from(
      JSON.stringify({
        action: 'verify_dscr_zkfetch',
        success: true,
        notice_type: 'dscr_verified',
        loan_id: '0x1234567890123456789012345678901234567890123456789012345678901234',
        borrower_address: '0x1234567890123456789012345678901234567890',
        dscr_value: '1.5000', // DSCR value as string
        monthly_noi: '8500.00',
        monthly_debt_service: '5666.67',
        meets_threshold: true,
        target_dscr: 1.25,
        transaction_count: 42,
        zkfetch_proof_hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        proof_verified: true,
        verification_id: 1,
        calculated_at: Math.floor(Date.now() / 1000),
      })
    ).toString('hex'),
};

// Mock Cartesi notice with different type (should be ignored)
export const mockCartesiNoticeOtherType = {
  index: 1,
  input: { index: 1, epoch: { index: 0 } },
  payload:
    '0x' +
    Buffer.from(
      JSON.stringify({
        type: 'some_other_type',
        data: 'some data',
      })
    ).toString('hex'),
};

// Mock GraphQL response for notices
export const mockCartesiGraphQLResponse = {
  data: {
    notices: {
      edges: [
        { node: mockCartesiNotice },
        { node: mockCartesiNoticeOtherType },
      ],
    },
  },
};

// Mock empty GraphQL response
export const mockCartesiGraphQLResponseEmpty = {
  data: {
    notices: {
      edges: [],
    },
  },
};

// Mock GraphQL error response
export const mockCartesiGraphQLError = {
  errors: [
    {
      message: 'Failed to fetch notices',
    },
  ],
};

// Mock Cartesi InputBox contract
export const createMockCartesiInputBox = () => ({
  addInput: vi.fn().mockResolvedValue({
    hash: '0xinputhash123...',
    wait: vi.fn().mockResolvedValue({
      status: 1,
      transactionHash: '0xtxhash123...',
    }),
  }),
});

// Mock submitInput function
export const mockSubmitInput = vi.fn().mockResolvedValue({
  success: true,
  inputIndex: 1,
  txHash: '0xtxhash123...',
});

// Mock DSCR calculation payload for Cartesi
export const mockDscrCalculationPayload = {
  type: 'calculate_dscr',
  loanId: 'test-loan-id',
  borrower: '0x1234567890123456789012345678901234567890',
  transactions: [
    { amount: -1000, date: '2024-12-01', category: 'INCOME' },
    { amount: 100, date: '2024-12-02', category: 'EXPENSE' },
    { amount: -500, date: '2024-12-05', category: 'INCOME' },
  ],
  windowMonths: 3,
  zkProofHash: '0xproofhash...',
  timestamp: Math.floor(Date.now() / 1000),
};

// Mock fetch for Cartesi GraphQL
export const createMockCartesiFetch = (response = mockCartesiGraphQLResponse) => {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(response),
  });
};
