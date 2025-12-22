import 'server-only';
import { createPublicClient, createWalletClient, http, encodeAbiParameters, parseAbi, getAddress, type Chain } from 'viem';
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
  };
  payload: string; // Hex-encoded JSON
}

// zkFetch + Cartesi DSCR verification notice
// Matches the response format from zkfetch.ts handler
export interface DscrVerifiedNotice {
  action: 'verify_dscr_zkfetch';
  success: boolean;
  notice_type: 'dscr_verified';
  loan_id: string;
  borrower_address: string;
  dscr_value: string;           // DSCR value as string (e.g., "1.7000")
  monthly_noi: string;
  monthly_debt_service: string;
  meets_threshold: boolean;
  target_dscr: number;
  transaction_count: number;
  zkfetch_proof_hash: string;   // The actual proof hash
  proof_verified: boolean;
  proof_error?: string;
  verification_id: number;
  calculated_at: number;
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

    // Check action type FIRST - silently skip non-DSCR notices
    if (!parsed.action || parsed.action !== 'verify_dscr_zkfetch') {
      // Don't log for expected non-DSCR notices (create_loan, register_borrower, etc.)
      return null;
    }

    // Now validate required fields for DSCR verification only
    if (!parsed.borrower_address || !parsed.loan_id) {
      console.error('[Relay] Invalid DSCR notice: missing required fields', {
        hasBorrower: !!parsed.borrower_address,
        hasLoan: !!parsed.loan_id
      });
      return null;
    }

    // Only relay successful verifications
    if (!parsed.success) {
      console.log(`[Relay] Skipping failed DSCR verification for loan ${parsed.loan_id}`);
      return null;
    }

    return parsed as DscrVerifiedNotice;
  } catch (error) {
    console.error('[Relay] Failed to parse notice payload:', error);
    return null;
  }
}

/**
 * Convert a loan ID string to bytes32 format
 * If already hex (0x...), pads to 32 bytes
 * If UUID string, converts to hex then pads
 */
function loanIdToBytes32(loanId: string): `0x${string}` {
  if (loanId.startsWith('0x')) {
    // Already hex, pad to 32 bytes
    const hex = loanId.slice(2).padEnd(64, '0');
    return `0x${hex}` as `0x${string}`;
  }
  // Convert UUID string to hex
  const hex = Buffer.from(loanId).toString('hex').padEnd(64, '0');
  return `0x${hex}` as `0x${string}`;
}

/**
 * Convert a proof hash string to bytes32 format
 */
function proofHashToBytes32(proofHash: string): `0x${string}` {
  if (proofHash.startsWith('0x')) {
    const hex = proofHash.slice(2).padEnd(64, '0');
    return `0x${hex}` as `0x${string}`;
  }
  // Hash the string to get a consistent bytes32
  const hex = Buffer.from(proofHash).toString('hex').padEnd(64, '0').slice(0, 64);
  return `0x${hex}` as `0x${string}`;
}

/**
 * Convert DSCR string value to uint256 (scaled by 1000)
 * e.g., "1.7000" -> 1700, "2.5" -> 2500
 */
function dscrToUint256(dscrValue: string): bigint {
  const num = parseFloat(dscrValue);
  return BigInt(Math.round(num * 1000));
}

/**
 * Calculate interest rate from DSCR (basis points)
 * Higher DSCR = lower risk = lower rate
 * Rates aligned with SBA loan standards (9-15% range)
 */
function calculateInterestRate(dscrValue: string): bigint {
  const dscr = parseFloat(dscrValue);
  // Rate tiers based on DSCR (in basis points) - SBA-aligned 9-15% range
  if (dscr >= 2.0) return BigInt(900);    // 9% - excellent creditworthiness
  if (dscr >= 1.5) return BigInt(1050);   // 10.5% - strong creditworthiness
  if (dscr >= 1.25) return BigInt(1200);  // 12% - good creditworthiness
  if (dscr >= 1.0) return BigInt(1350);   // 13.5% - acceptable creditworthiness
  return BigInt(1500);                     // 15% - high risk
}

/**
 * Encode notice data for the smart contract
 * Encodes: bytes32 loanId, uint256 dscrValue, uint256 interestRate, bytes32 proofHash
 */
export function encodeNoticeData(notice: DscrVerifiedNotice): `0x${string}` {
  const loanIdBytes = loanIdToBytes32(notice.loan_id);
  const proofHashBytes = proofHashToBytes32(notice.zkfetch_proof_hash);
  const dscrValue = dscrToUint256(notice.dscr_value);
  const interestRate = calculateInterestRate(notice.dscr_value);

  return encodeAbiParameters(
    [
      { type: 'bytes32', name: 'loanId' },
      { type: 'uint256', name: 'dscrValue' },
      { type: 'uint256', name: 'interestRate' },
      { type: 'bytes32', name: 'proofHash' },
    ],
    [loanIdBytes, dscrValue, interestRate, proofHashBytes]
  ) as `0x${string}`;
}

// Notice type string that the contract expects
const DSCR_VERIFIED_ZKFETCH_TYPE = 'dscr_verified_zkfetch';

/**
 * Relay a single DSCR verification notice to the SimpleLoanPool contract
 */
export async function relayNotice(notice: DscrVerifiedNotice): Promise<string | null> {
  const noticeId = `${notice.action}-${notice.borrower_address}-${notice.loan_id}-${notice.verification_id}`;

  // Skip if already processed
  if (processedNotices.has(noticeId)) {
    console.log(`[Relay] Skipping already processed notice: ${noticeId}`);
    return null;
  }

  try {
    const { publicClient, walletClient, account } = createClients();

    // Normalize the borrower address with proper checksum
    const rawAddress = notice.borrower_address.startsWith('0x')
      ? notice.borrower_address
      : `0x${notice.borrower_address}`;
    const borrowerAddress = getAddress(rawAddress);

    const data = encodeNoticeData(notice);

    console.log(`[Relay] Relaying DSCR notice:`, {
      loanId: notice.loan_id,
      borrower: borrowerAddress,
      dscr: notice.dscr_value,
      proofHash: notice.zkfetch_proof_hash,
      verificationId: notice.verification_id,
    });

    // Simulate the transaction first
    const { request } = await publicClient.simulateContract({
      account,
      address: SIMPLE_LOAN_POOL_ADDRESS,
      abi: SIMPLE_LOAN_POOL_ABI,
      functionName: 'handleNotice',
      args: [DSCR_VERIFIED_ZKFETCH_TYPE, borrowerAddress as `0x${string}`, data],
    });

    // Execute the transaction
    const txHash = await walletClient.writeContract(request);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    console.log(
      `[Relay] DSCR notice relayed successfully:`,
      {
        txHash,
        status: receipt.status,
        loanId: notice.loan_id,
        blockNumber: receipt.blockNumber,
      }
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
  dscrValue: string,
  proofHash: string
): Promise<string | null> {
  const notice: DscrVerifiedNotice = {
    action: 'verify_dscr_zkfetch',
    success: true,
    notice_type: 'dscr_verified',
    borrower_address: borrowerAddress,
    loan_id: loanId,
    dscr_value: dscrValue,
    monthly_noi: '0',
    monthly_debt_service: '0',
    meets_threshold: true,
    target_dscr: 1.25,
    transaction_count: 0,
    zkfetch_proof_hash: proofHash,
    proof_verified: true,
    verification_id: Date.now(),
    calculated_at: Date.now(),
  };

  return relayNotice(notice);
}

/**
 * Fetch a specific notice from Cartesi by loan ID
 */
export async function fetchNoticeByLoanId(loanId: string): Promise<DscrVerifiedNotice | null> {
  const notices = await fetchCartesiNotices(50);

  for (const notice of notices) {
    const parsed = parseNoticePayload(notice.payload);
    if (parsed && parsed.loan_id === loanId) {
      return parsed;
    }
  }

  return null;
}

/**
 * Get relay service status
 */
export function getRelayStatus() {
  return {
    processedCount: processedNotices.size,
    cartesiGraphqlUrl: CARTESI_GRAPHQL_URL,
    loanPoolAddress: SIMPLE_LOAN_POOL_ADDRESS,
    chainId: CHAIN_ID,
    rpcUrl: RPC_URL,
  };
}
