import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Mock server-only import (Next.js specific)
vi.mock('server-only', () => ({}));

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.PLAID_CLIENT_ID = 'test_client_id';
  process.env.PLAID_SECRET = 'test_secret';
  process.env.PLAID_ENV = 'sandbox';
  process.env.RECLAIM_APP_ID = 'test_reclaim_app_id';
  process.env.RECLAIM_APP_SECRET = 'test_reclaim_secret';
  process.env.NEXT_PUBLIC_RPC_URL = 'http://localhost:8545';
  process.env.NEXT_PUBLIC_CHAIN_ID = '31337';
  process.env.CARTESI_GRAPHQL_URL = 'http://localhost:8080/graphql';
  process.env.CARTESI_DAPP_ADDRESS = '0xab7528bb862fb57e8a2bcd567a2e929a0be56a5e';
  process.env.RELAY_PRIVATE_KEY =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  process.env.NEXT_PUBLIC_LOAN_POOL_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  process.env.SIMPLE_LOAN_POOL_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});
