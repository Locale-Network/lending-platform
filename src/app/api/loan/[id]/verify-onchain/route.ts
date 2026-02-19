import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import { createPublicClient, http, parseAbi, type Chain } from 'viem';
import { arbitrum, arbitrumSepolia } from 'viem/chains';
import { fetchNoticeByLoanId, getRelayStatus } from '@/services/relay';
import { getExplorerUrl } from '@/lib/explorer';

/**
 * GET /api/loan/[id]/verify-onchain
 *
 * Verify that a loan's DSCR proof has been stored on-chain.
 * This checks both Cartesi (for the notice) and the SimpleLoanPool contract.
 *
 * Returns:
 * - cartesi: Notice from Cartesi GraphQL (if found)
 * - onchain: Data from SimpleLoanPool contract (if found)
 * - verified: true if both match
 */

// Local Anvil chain for development
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

// SimpleLoanPool ABI for reading DSCR results
const SIMPLE_LOAN_POOL_ABI = parseAbi([
  'function hasZkFetchVerifiedDscr(bytes32 _loanId) external view returns (bool)',
  'function getZkFetchDscrResult(bytes32 _loanId) external view returns (uint256 dscrValue, uint256 interestRate, bytes32 proofHash, uint256 verifiedAt)',
  'function zkFetchDscrResults(bytes32) external view returns (uint256 dscrValue, uint256 interestRate, bytes32 proofHash, uint256 verifiedAt, bool isValid)',
]);

const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID ? parseInt(process.env.NEXT_PUBLIC_CHAIN_ID, 10) : undefined;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const SIMPLE_LOAN_POOL_ADDRESS = (process.env.SIMPLE_LOAN_POOL_ADDRESS || process.env.NEXT_PUBLIC_LOAN_POOL_ADDRESS) as `0x${string}`;

function getChain(): Chain {
  if (!CHAIN_ID) {
    throw new Error('NEXT_PUBLIC_CHAIN_ID not configured');
  }
  switch (CHAIN_ID) {
    case 31337:
      return anvil;
    case 421614:
      return arbitrumSepolia;
    case 42161:
      return arbitrum;
    default:
      throw new Error(`Unsupported NEXT_PUBLIC_CHAIN_ID: ${CHAIN_ID}`);
  }
}

/**
 * Convert loan ID string to bytes32 for contract calls
 */
function loanIdToBytes32(loanId: string): `0x${string}` {
  if (loanId.startsWith('0x')) {
    const hex = loanId.slice(2).padEnd(64, '0');
    return `0x${hex}` as `0x${string}`;
  }
  const hex = Buffer.from(loanId).toString('hex').padEnd(64, '0');
  return `0x${hex}` as `0x${string}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const accountAddress = session?.address;

    if (!accountAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: loanApplicationId } = await params;

    // Get relay service status
    const relayStatus = getRelayStatus();

    // Step 1: Check Cartesi GraphQL for the notice
    let cartesiNotice = null;
    let cartesiError = null;

    try {
      cartesiNotice = await fetchNoticeByLoanId(loanApplicationId);
    } catch (error) {
      // SECURITY: Log full error internally, return generic message to client
      console.error('[Verify On-Chain] Cartesi fetch error:', error);
      cartesiError = 'Failed to fetch from Cartesi';
    }

    // Step 2: Check on-chain SimpleLoanPool contract
    let onchainData = null;
    let onchainError = null;
    let hasVerifiedDscr = false;

    try {
      const chain = getChain();
      const publicClient = createPublicClient({
        chain,
        transport: http(RPC_URL),
      });

      const loanIdBytes = loanIdToBytes32(loanApplicationId);

      // Check if loan has verified DSCR
      hasVerifiedDscr = await publicClient.readContract({
        address: SIMPLE_LOAN_POOL_ADDRESS,
        abi: SIMPLE_LOAN_POOL_ABI,
        functionName: 'hasZkFetchVerifiedDscr',
        args: [loanIdBytes],
      }) as boolean;

      if (hasVerifiedDscr) {
        // Get the full DSCR result
        const result = await publicClient.readContract({
          address: SIMPLE_LOAN_POOL_ADDRESS,
          abi: SIMPLE_LOAN_POOL_ABI,
          functionName: 'getZkFetchDscrResult',
          args: [loanIdBytes],
        }) as [bigint, bigint, `0x${string}`, bigint];

        onchainData = {
          dscrValue: Number(result[0]) / 1000, // Convert from scaled integer
          dscrValueRaw: result[0].toString(),
          interestRate: Number(result[1]) / 100, // Convert from basis points to percentage
          interestRateBps: result[1].toString(),
          proofHash: result[2],
          verifiedAt: new Date(Number(result[3]) * 1000).toISOString(),
          verifiedAtTimestamp: result[3].toString(),
        };
      }
    } catch (error) {
      // SECURITY: Log full error internally, return generic message to client
      console.error('[Verify On-Chain] Contract read error:', error);
      onchainError = 'Failed to read from contract';
    }

    // Step 3: Determine verification status
    const verified = hasVerifiedDscr && cartesiNotice !== null;

    // Build explorer URL for the proof hash
    let explorerUrl = null;
    if (onchainData?.proofHash) {
      try {
        explorerUrl = getExplorerUrl('address', SIMPLE_LOAN_POOL_ADDRESS);
      } catch {
        // Unsupported chain ID
      }
    }

    return NextResponse.json({
      loanId: loanApplicationId,
      loanIdBytes32: loanIdToBytes32(loanApplicationId),
      verified,
      cartesi: {
        found: cartesiNotice !== null,
        notice: cartesiNotice ? {
          loanId: cartesiNotice.loan_id,
          borrower: cartesiNotice.borrower_address,
          dscrValue: cartesiNotice.dscr_value,
          proofHash: cartesiNotice.zkfetch_proof_hash,
          meetsThreshold: cartesiNotice.meets_threshold,
          verificationId: cartesiNotice.verification_id,
          calculatedAt: new Date(cartesiNotice.calculated_at).toISOString(),
        } : null,
        error: cartesiError,
      },
      onchain: {
        found: hasVerifiedDscr,
        data: onchainData,
        error: onchainError,
        contractAddress: SIMPLE_LOAN_POOL_ADDRESS,
        explorerUrl,
      },
      relayService: relayStatus,
      chain: {
        id: CHAIN_ID,
      },
    });
  } catch (error) {
    console.error('[Verify On-Chain] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify on-chain status' },
      { status: 500 }
    );
  }
}
