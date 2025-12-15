import { vi } from 'vitest';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';

export type MockPrismaClient = DeepMockProxy<PrismaClient>;

export const createMockPrismaClient = (): MockPrismaClient => {
  return mockDeep<PrismaClient>();
};

// Factory for creating mock loan application data
export const mockLoanApplication = (overrides: Record<string, unknown> = {}) => ({
  id: 'test-loan-id',
  accountAddress: '0x1234567890123456789012345678901234567890',
  businessLegalName: 'Test Business LLC',
  businessAddress: '123 Main St',
  businessState: 'CA',
  businessCity: 'San Francisco',
  businessZipCode: '94102',
  ein: '12-3456789',
  businessFoundedYear: 2020,
  businessLegalStructure: 'LLC',
  businessWebsite: 'https://testbusiness.com',
  businessPrimaryIndustry: 'Technology',
  businessDescription: 'A test business for unit testing',
  status: 'APPROVED',
  plaidAccessToken: 'test-access-token',
  plaidTransactionsCursor: null,
  transactionWindowMonths: 3,
  amount: 10000,
  loanAmount: BigInt(10000000000), // 10000 USDC with 6 decimals
  isSubmitted: true,
  hasOutstandingLoans: false,
  lendScore: 75,
  lendScoreReasonCodes: [],
  lendScoreRetrievedAt: null,
  lastSyncedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-12-01'),
  ...overrides,
});

// Factory for creating mock transaction data
export const mockTransaction = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  transactionId: 'tx-001',
  accountId: 'account-001',
  amount: 100.0,
  currency: 'USD',
  merchant: 'Test Merchant',
  merchantId: 'merchant-001',
  date: new Date('2024-12-01'),
  isDeleted: false,
  loanApplicationId: 'test-loan-id',
  ...overrides,
});

// Factory for creating mock account data
export const mockAccount = (overrides: Record<string, unknown> = {}) => ({
  address: '0x1234567890123456789012345678901234567890',
  eoaAddress: '0x0987654321098765432109876543210987654321',
  privyUserId: 'privy-user-123',
  email: 'test@example.com',
  authProvider: 'email',
  role: 'BORROWER',
  borrowerNFTTokenId: '1',
  investorNFTTokenId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-12-01'),
  ...overrides,
});

// Factory for creating mock Plaid item access token
export const mockPlaidItemAccessToken = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  accessToken: 'test-access-token',
  itemId: 'test-item-id',
  accountAddress: '0x1234567890123456789012345678901234567890',
  loanApplicationId: 'test-loan-id',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-12-01'),
  ...overrides,
});

// Factory for creating mock DSCR calculation log
export const mockDSCRCalculationLog = (overrides: Record<string, unknown> = {}) => ({
  id: 'dscr-log-001',
  loanApplicationId: 'test-loan-id',
  transactionCount: 50,
  windowMonths: 3,
  status: 'COMPLETED',
  calculatedRate: 850, // 8.5% in basis points
  noticeIndex: 1,
  submittedAt: new Date('2024-12-01'),
  completedAt: new Date('2024-12-01'),
  ...overrides,
});
