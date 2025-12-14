import { vi } from 'vitest';

// Mock transaction hash
export const mockTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

// Mock transaction receipt
export const mockTransactionReceipt = {
  status: 'success' as const,
  transactionHash: mockTxHash,
  blockNumber: BigInt(12345678),
  blockHash: '0xblockhash123...',
  gasUsed: BigInt(100000),
  effectiveGasPrice: BigInt(1000000000),
  logs: [],
};

// Mock simulate contract response
export const mockSimulateContractResponse = {
  request: {
    account: '0xrelayservice...',
    address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    abi: [],
    functionName: 'handleNotice',
    args: ['dscr_verified_zkfetch', '0xborrower...', '0xdata...'],
  },
  result: undefined,
};

// Create mock public client
export const createMockPublicClient = () => ({
  simulateContract: vi.fn().mockResolvedValue(mockSimulateContractResponse),
  waitForTransactionReceipt: vi.fn().mockResolvedValue(mockTransactionReceipt),
  getBlockNumber: vi.fn().mockResolvedValue(BigInt(12345678)),
  getChainId: vi.fn().mockResolvedValue(31337),
  readContract: vi.fn().mockResolvedValue(undefined),
});

// Create mock wallet client
export const createMockWalletClient = () => ({
  writeContract: vi.fn().mockResolvedValue(mockTxHash),
  account: {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  },
  chain: {
    id: 31337,
    name: 'Anvil',
  },
});

// Factory to create both clients
export const createMockViemClients = () => ({
  publicClient: createMockPublicClient(),
  walletClient: createMockWalletClient(),
});

// Mock account for relay service
export const mockRelayAccount = {
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
};

// Mock failed transaction
export const mockFailedTransactionReceipt = {
  status: 'reverted' as const,
  transactionHash: mockTxHash,
  blockNumber: BigInt(12345678),
  blockHash: '0xblockhash123...',
  gasUsed: BigInt(50000),
  effectiveGasPrice: BigInt(1000000000),
  logs: [],
};

// Mock contract read results
export const mockContractReadResults = {
  hasZkFetchVerifiedDscr: true,
  getZkFetchDscrResult: {
    dscrValue: BigInt(15000), // 1.5 DSCR
    interestRate: BigInt(850), // 8.5%
    proofHash: '0xproofhash...',
    verifiedAt: BigInt(Math.floor(Date.now() / 1000)),
    isValid: true,
  },
  getBorrowerLatestVerifiedLoan: '0xloanid...',
};
