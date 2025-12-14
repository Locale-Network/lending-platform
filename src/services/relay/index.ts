import 'server-only';
import { createPublicClient, createWalletClient, http, encodeFunctionData, parseAbi, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum, arbitrumSepolia } from 'viem/chains';

// Define local Anvil chain for local development
const anvil: Chain = {
  id: 31337,
  name: 'Anvil Local',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
    },
  },
  testnet: true,
};

/**
 * Relay Service for Cartesi -> Arbitrum Bridge
 *
 * This service polls the Cartesi GraphQL endpoint for notices and
 * relays them to the SimpleLoanPool contract on Arbitrum.
 *
 * Architecture (zkFetch + Cartesi):
 * 1. zkFetch wraps Plaid API calls with ZK proofs
 * 2. Cartesi DApp verifies proofs and calculates DSCR
 * 3. Cartesi emits dscr_verified_zkfetch notices
 * 4. Relay service polls Cartesi GraphQL for new notices
 * 5. Relay service calls SimpleLoanPool.handleNotice() with verified data
 *
 * Security:
 * - Relay service is the only authorized caller of handleNotice()
 * - Uses a dedicated private key stored in RELAY_PRIVATE_KEY
 * - Rate limited to prevent DoS
 */

// Types for Cartesi notices
export interface CartesiNotice {
  index: number;
  input: {
    index: number;
    epoch: {
      index: number;
    };
  };
  payload: string; // Hex-encoded JSON
}

// zkFetch + Cartesi DSCR verification notice
export interface DscrVerifiedNotice {
  type: 'dscr_verified_zkfetch';
  borrower_address: string;
  loan_id: string;
  dscr_value: number;      // DSCR value scaled by 1000 (e.g., 1500 = 1.5)
  interest_rate: number;   // Interest rate in basis points (e.g., 500 = 5%)
  proof_hash: string;
  timestamp: string;
}

// SimpleLoanPool ABI for handleNotice
const SIMPLE_LOAN_POOL_ABI = parseAbi([
  'function handleNotice(string calldata noticeType, address borrower, bytes calldata data) external',
]);

// Configuration
const CARTESI_GRAPHQL_URL = process.env.CARTESI_GRAPHQL_URL || 'http://localhost:8080/graphql';
const SIMPLE_LOAN_POOL_ADDRESS = (process.env.SIMPLE_LOAN_POOL_ADDRESS || process.env.NEXT_PUBLIC_LOAN_POOL_ADDRESS) as `0x${string}`;
const RELAY_PRIVATE_KEY = process.env.RELAY_PRIVATE_KEY as `0x${string}`;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://arb1.arbitrum.io/rpc';
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '421614', 10);

// Track processed notices to avoid duplicates
const processedNotices = new Set<string>();

/**
 * Get the appropriate chain configuration based on chain ID
 */
function getChain(): Chain {
  switch (CHAIN_ID) {
    case 31337:
      return anvil;
    case 421614:
      return arbitrumSepolia;
    case 42161:
    default:
      return arbitrum;
  }
}

/**
 * Create Viem clients for the configured chain
 */
function createClients() {
  if (!RELAY_PRIVATE_KEY) {
    throw new Error('RELAY_PRIVATE_KEY not configured');
  }

  if (!SIMPLE_LOAN_POOL_ADDRESS) {
    throw new Error('SIMPLE_LOAN_POOL_ADDRESS not configured');
  }

  const account = privateKeyToAccount(RELAY_PRIVATE_KEY);
  const chain = getChain();

  const publicClient = createPublicClient({
    chain,
    transport: http(RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(RPC_URL),
  });

  return { publicClient, walletClient, account };
}

/**
 * Fetch notices from Cartesi GraphQL endpoint
 */
export async function fetchCartesiNotices(limit = 10): Promise<CartesiNotice[]> {
  const query = `
    query GetNotices($limit: Int!) {
      notices(last: $limit) {
        edges {
          node {
            index
            input {
              index
              epoch {
                index
              }
            }
            payload
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(CARTESI_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { limit } }),
    });

    if (!response.ok) {
      throw new Error(`Cartesi GraphQL error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.errors) {
      console.error('[Relay] GraphQL errors:', data.errors);
      return [];
    }

    return data.data?.notices?.edges?.map((edge: { node: CartesiNotice }) => edge.node) || [];
  } catch (error) {
    console.error('[Relay] Failed to fetch notices:', error);
    return [];
  }
}

/**
 * Parse a Cartesi notice payload
 */
export function parseNoticePayload(hexPayload: string): DscrVerifiedNotice | null {
  try {
    // Remove 0x prefix and decode hex to string
    const hex = hexPayload.startsWith('0x') ? hexPayload.slice(2) : hexPayload;
    const jsonStr = Buffer.from(hex, 'hex').toString('utf8');
    const parsed = JSON.parse(jsonStr);

    // Validate required fields for DSCR verification
    if (!parsed.type || !parsed.borrower_address || !parsed.loan_id) {
      console.error('[Relay] Invalid notice: missing required fields');
      return null;
    }

    // Only handle dscr_verified_zkfetch notices
    if (parsed.type !== 'dscr_verified_zkfetch') {
      console.log(`[Relay] Skipping non-DSCR notice type: ${parsed.type}`);
      return null;
    }

    return parsed as DscrVerifiedNotice;
  } catch (error) {
    console.error('[Relay] Failed to parse notice payload:', error);
    return null;
  }
}

/**
 * Encode notice data for the smart contract
 * Encodes: bytes32 loanId, uint256 dscrValue, uint256 interestRate, bytes32 proofHash
 */
export function encodeNoticeData(notice: DscrVerifiedNotice): `0x${string}` {
  const loanId = notice.loan_id.startsWith('0x')
    ? notice.loan_id
    : `0x${notice.loan_id}`;
  const proofHash = notice.proof_hash.startsWith('0x')
    ? notice.proof_hash
    : `0x${notice.proof_hash}`;

  return encodeFunctionData({
    abi: parseAbi(['function encode(bytes32 loanId, uint256 dscrValue, uint256 interestRate, bytes32 proofHash)']),
    functionName: 'encode',
    args: [
      loanId as `0x${string}`,
      BigInt(notice.dscr_value),
      BigInt(notice.interest_rate),
      proofHash as `0x${string}`,
    ],
  }).slice(10) as `0x${string}`; // Remove function selector
}

/**
 * Relay a single DSCR verification notice to the SimpleLoanPool contract
 */
export async function relayNotice(notice: DscrVerifiedNotice): Promise<string | null> {
  const noticeId = `${notice.type}-${notice.borrower_address}-${notice.loan_id}`;

  // Skip if already processed
  if (processedNotices.has(noticeId)) {
    console.log(`[Relay] Skipping already processed notice: ${noticeId}`);
    return null;
  }

  try {
    const { publicClient, walletClient, account } = createClients();

    const borrowerAddress = notice.borrower_address.startsWith('0x')
      ? notice.borrower_address
      : `0x${notice.borrower_address}`;

    const data = encodeNoticeData(notice);

    console.log(`[Relay] Relaying DSCR notice: loanId=${notice.loan_id}, borrower=${borrowerAddress}, dscr=${notice.dscr_value}`);

    // Simulate the transaction first
    const { request } = await publicClient.simulateContract({
      account,
      address: SIMPLE_LOAN_POOL_ADDRESS,
      abi: SIMPLE_LOAN_POOL_ABI,
      functionName: 'handleNotice',
      args: [notice.type, borrowerAddress as `0x${string}`, data],
    });

    // Execute the transaction
    const txHash = await walletClient.writeContract(request);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    console.log(
      `[Relay] DSCR notice relayed: txHash=${txHash}, status=${receipt.status}`
    );

    // Mark as processed
    processedNotices.add(noticeId);

    return txHash;
  } catch (error) {
    console.error(`[Relay] Failed to relay notice ${noticeId}:`, error);
    return null;
  }
}

/**
 * Poll for new DSCR verification notices and relay them
 */
export async function pollAndRelayNotices(): Promise<number> {
  console.log('[Relay] Polling for DSCR verification notices...');

  const notices = await fetchCartesiNotices(20);
  let relayedCount = 0;

  for (const cartesiNotice of notices) {
    const parsed = parseNoticePayload(cartesiNotice.payload);

    // parseNoticePayload only returns dscr_verified_zkfetch notices
    if (!parsed) {
      continue;
    }

    const txHash = await relayNotice(parsed);
    if (txHash) {
      relayedCount++;
    }

    // Rate limit: wait between transactions
    if (relayedCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`[Relay] Relayed ${relayedCount} DSCR notices`);
  return relayedCount;
}

/**
 * Start the relay service polling loop
 */
export async function startRelayService(pollIntervalMs = 30000): Promise<void> {
  const chain = getChain();
  console.log('[Relay] Starting relay service...');
  console.log(`[Relay] Chain: ${chain.name} (${chain.id})`);
  console.log(`[Relay] RPC URL: ${RPC_URL}`);
  console.log(`[Relay] Cartesi GraphQL: ${CARTESI_GRAPHQL_URL}`);
  console.log(`[Relay] SimpleLoanPool: ${SIMPLE_LOAN_POOL_ADDRESS}`);
  console.log(`[Relay] Poll interval: ${pollIntervalMs}ms`);

  // Initial poll
  await pollAndRelayNotices();

  // Start polling loop
  setInterval(async () => {
    try {
      await pollAndRelayNotices();
    } catch (error) {
      console.error('[Relay] Polling error:', error);
    }
  }, pollIntervalMs);
}

/**
 * Manually relay a DSCR verification event (for testing/admin)
 */
export async function manualRelayDscr(
  borrowerAddress: string,
  loanId: string,
  dscrValue: number,
  interestRate: number,
  proofHash: string
): Promise<string | null> {
  const notice: DscrVerifiedNotice = {
    type: 'dscr_verified_zkfetch',
    borrower_address: borrowerAddress,
    loan_id: loanId,
    dscr_value: dscrValue,
    interest_rate: interestRate,
    proof_hash: proofHash,
    timestamp: new Date().toISOString(),
  };

  return relayNotice(notice);
}
