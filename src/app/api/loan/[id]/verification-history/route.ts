import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/authorization';
import { fetchCartesiNotices, parseNoticePayload, type DscrVerifiedNotice } from '@/services/relay';
import { createPublicClient, http, parseAbi, type Chain } from 'viem';
import { arbitrum, arbitrumSepolia } from 'viem/chains';

// Local Anvil chain for development
const anvil: Chain = {
  id: 31337,
  name: 'Anvil Local',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
  testnet: true,
};

const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '421614', 10);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';
const SIMPLE_LOAN_POOL_ADDRESS = (process.env.SIMPLE_LOAN_POOL_ADDRESS || process.env.NEXT_PUBLIC_LOAN_POOL_ADDRESS) as `0x${string}`;

const SIMPLE_LOAN_POOL_ABI = parseAbi([
  'function hasZkFetchVerifiedDscr(bytes32 _loanId) external view returns (bool)',
  'function getZkFetchDscrResult(bytes32 _loanId) external view returns (uint256 dscrValue, uint256 interestRate, bytes32 proofHash, uint256 verifiedAt)',
]);

function getChain(): Chain {
  switch (CHAIN_ID) {
    case 31337: return anvil;
    case 421614: return arbitrumSepolia;
    case 42161:
    default: return arbitrum;
  }
}

function loanIdToBytes32(loanId: string): `0x${string}` {
  if (loanId.startsWith('0x')) {
    const hex = loanId.slice(2).padEnd(64, '0');
    return `0x${hex}` as `0x${string}`;
  }
  const hex = Buffer.from(loanId).toString('hex').padEnd(64, '0');
  return `0x${hex}` as `0x${string}`;
}

function getExplorerUrl(txHash?: string): string | null {
  if (!txHash) return null;
  if (CHAIN_ID === 421614) {
    return `https://sepolia.arbiscan.io/tx/${txHash}`;
  } else if (CHAIN_ID === 42161) {
    return `https://arbiscan.io/tx/${txHash}`;
  }
  return null;
}

function getContractExplorerUrl(): string | null {
  if (CHAIN_ID === 421614) {
    return `https://sepolia.arbiscan.io/address/${SIMPLE_LOAN_POOL_ADDRESS}`;
  } else if (CHAIN_ID === 42161) {
    return `https://arbiscan.io/address/${SIMPLE_LOAN_POOL_ADDRESS}`;
  }
  return null;
}

/**
 * Decode on-chain proof hash (bytes32 stored as hex-encoded ASCII) to raw hex string
 * On-chain: 0x373637663865383538663835613538613461... = hex-encoded "767f8e858f85a58a4a..."
 * Returns: "767f8e858f85a58a4a..."
 */
function decodeOnChainProofHash(onchainHash: `0x${string}`): string {
  // Remove 0x prefix and decode hex to ASCII
  const hexStr = onchainHash.slice(2);
  let decoded = '';
  for (let i = 0; i < hexStr.length; i += 2) {
    const charCode = parseInt(hexStr.slice(i, i + 2), 16);
    if (charCode === 0) break; // Stop at null terminator
    decoded += String.fromCharCode(charCode);
  }
  return decoded;
}

interface VerificationRecord {
  id: string;
  source: 'cartesi' | 'onchain';
  loanId: string;
  borrowerAddress: string;
  dscrValue: number;
  dscrValueFormatted: string;
  interestRate: number;
  interestRateFormatted: string;
  proofHash: string;
  transactionCount: number;
  meetsThreshold: boolean;
  verifiedAt: string;
  verificationId?: number;
  // On-chain specific
  onchainTxHash?: string;
  explorerUrl?: string | null;
  // Status
  relayedToChain: boolean;
}

/**
 * GET /api/loan/[id]/verification-history
 *
 * Fetches the complete verification history for a loan from Cartesi.
 * This includes all DSCR verification notices from the Cartesi GraphQL endpoint
 * and checks their on-chain status.
 */
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

    // Fetch all notices from Cartesi
    const cartesiNotices = await fetchCartesiNotices(100);
    const verifications: VerificationRecord[] = [];

    // Filter and parse notices for this loan
    for (const notice of cartesiNotices) {
      const parsed = parseNoticePayload(notice.payload);
      if (parsed && parsed.loan_id === loanApplicationId) {
        const dscrNum = parseFloat(parsed.dscr_value);
        // Calculate interest rate from DSCR (matches relay service calculateInterestRate)
        // Rate tiers based on DSCR (in basis points) - SBA-aligned 9-15% range
        let interestRate: number;
        if (dscrNum >= 2.0) interestRate = 900;       // 9% - excellent creditworthiness
        else if (dscrNum >= 1.5) interestRate = 1050; // 10.5% - strong creditworthiness
        else if (dscrNum >= 1.25) interestRate = 1200; // 12% - good creditworthiness
        else if (dscrNum >= 1.0) interestRate = 1350; // 13.5% - acceptable creditworthiness
        else interestRate = 1500;                      // 15% - high risk

        verifications.push({
          id: `cartesi-${notice.index}-${parsed.verification_id}`,
          source: 'cartesi',
          loanId: parsed.loan_id,
          borrowerAddress: parsed.borrower_address,
          dscrValue: Math.round(dscrNum * 1000),
          dscrValueFormatted: dscrNum.toFixed(2),
          interestRate,
          interestRateFormatted: `${(interestRate / 100).toFixed(2)}%`,
          proofHash: parsed.zkfetch_proof_hash,
          transactionCount: parsed.transaction_count,
          meetsThreshold: parsed.meets_threshold,
          verifiedAt: new Date(parsed.calculated_at * 1000).toISOString(),
          verificationId: parsed.verification_id,
          relayedToChain: false, // Will update below
        });
      }
    }

    // Check on-chain status for this loan
    let onchainVerification: VerificationRecord | null = null;

    try {
      const chain = getChain();
      const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
      const loanIdBytes = loanIdToBytes32(loanApplicationId);

      const hasVerified = await publicClient.readContract({
        address: SIMPLE_LOAN_POOL_ADDRESS,
        abi: SIMPLE_LOAN_POOL_ABI,
        functionName: 'hasZkFetchVerifiedDscr',
        args: [loanIdBytes],
      }) as boolean;

      if (hasVerified) {
        const result = await publicClient.readContract({
          address: SIMPLE_LOAN_POOL_ADDRESS,
          abi: SIMPLE_LOAN_POOL_ABI,
          functionName: 'getZkFetchDscrResult',
          args: [loanIdBytes],
        }) as [bigint, bigint, `0x${string}`, bigint];

        const dscrValue = Number(result[0]);
        const interestRate = Number(result[1]);

        // Decode the on-chain proof hash from hex-encoded ASCII to raw hex
        const decodedProofHash = decodeOnChainProofHash(result[2]);

        onchainVerification = {
          id: `onchain-${loanApplicationId}`,
          source: 'onchain',
          loanId: loanApplicationId,
          borrowerAddress: accountAddress,
          dscrValue,
          dscrValueFormatted: (dscrValue / 1000).toFixed(2),
          interestRate,
          interestRateFormatted: `${(interestRate / 100).toFixed(2)}%`,
          proofHash: decodedProofHash,
          transactionCount: 0, // Not stored on-chain
          meetsThreshold: dscrValue >= 1250, // 1.25 threshold
          verifiedAt: new Date(Number(result[3]) * 1000).toISOString(),
          relayedToChain: true,
          explorerUrl: getContractExplorerUrl(),
        };

        // Mark matching Cartesi verifications as relayed
        // Compare first 32 chars since on-chain stores truncated hash
        for (const v of verifications) {
          if (v.proofHash.slice(0, 32) === decodedProofHash.slice(0, 32)) {
            v.relayedToChain = true;
            v.explorerUrl = getContractExplorerUrl();
          }
        }
      }
    } catch (error) {
      console.log('[Verification History] On-chain check failed:', error);
    }

    // Combine and sort by date (newest first)
    // Filter out Cartesi verifications that match the on-chain one (compare first 32 chars)
    const allVerifications = onchainVerification
      ? [onchainVerification, ...verifications.filter(v =>
          v.proofHash.slice(0, 32) !== onchainVerification?.proofHash.slice(0, 32)
        )]
      : verifications;

    allVerifications.sort((a, b) =>
      new Date(b.verifiedAt).getTime() - new Date(a.verifiedAt).getTime()
    );

    return NextResponse.json({
      loanId: loanApplicationId,
      verifications: allVerifications,
      summary: {
        totalVerifications: allVerifications.length,
        onchainVerified: !!onchainVerification,
        latestDscr: allVerifications[0]?.dscrValueFormatted || null,
        latestInterestRate: allVerifications[0]?.interestRateFormatted || null,
        contractAddress: SIMPLE_LOAN_POOL_ADDRESS,
        contractExplorerUrl: getContractExplorerUrl(),
      },
    });
  } catch (error) {
    console.error('[Verification History] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch verification history' },
      { status: 500 }
    );
  }
}
