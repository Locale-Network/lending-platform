import 'server-only';

import {
  eligibilityRegistryAbi,
  ELIGIBILITY_REGISTRY_ADDRESS,
} from '@/lib/contracts/eligibilityRegistry';
import { assertGasPriceSafe } from '@/lib/contracts/gas-safety';
import {
  createLoanOpsWalletClient,
  createSharedPublicClient,
} from '@/lib/privy/wallet-client';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'eligibility-registry' });

function getRegistryAddress(): `0x${string}` {
  if (!ELIGIBILITY_REGISTRY_ADDRESS) {
    throw new Error('NEXT_PUBLIC_ELIGIBILITY_REGISTRY_ADDRESS not configured');
  }
  return ELIGIBILITY_REGISTRY_ADDRESS;
}

export interface WriteResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  error?: string;
}

/**
 * Set the eligibility status for an investor on-chain.
 * Requires VERIFIER_ROLE on the EligibilityRegistry contract.
 *
 * @param investor - Wallet address of the investor
 * @param status - 0 = INELIGIBLE, 1 = ACCREDITED, 2 = NON_ACCREDITED
 */
export async function setInvestorStatus(
  investor: `0x${string}`,
  status: number
): Promise<WriteResult> {
  try {
    const registryAddress = getRegistryAddress();
    const { walletClient, publicClient, account, chain } = createLoanOpsWalletClient();

    await assertGasPriceSafe(() => publicClient.getGasPrice());

    await publicClient.simulateContract({
      account,
      address: registryAddress,
      abi: eligibilityRegistryAbi,
      functionName: 'setInvestorStatus',
      args: [investor, status],
    });

    const txHash = await walletClient.writeContract({
      account,
      chain,
      address: registryAddress,
      abi: eligibilityRegistryAbi,
      functionName: 'setInvestorStatus',
      args: [investor, status],
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 120_000,
      pollingInterval: 2_000,
    });

    if (receipt.status !== 'success') {
      throw new Error('Transaction failed on-chain');
    }

    log.info(
      { investor, status, txHash: receipt.transactionHash },
      'setInvestorStatus succeeded'
    );

    return {
      success: true,
      txHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber),
    };
  } catch (error) {
    log.error({ err: error, investor, status }, 'setInvestorStatus failed');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get the current eligibility status of an investor.
 * Returns 0 (INELIGIBLE), 1 (ACCREDITED), or 2 (NON_ACCREDITED).
 */
export async function getInvestorStatus(investor: `0x${string}`): Promise<number> {
  const publicClient = createSharedPublicClient();
  const status = await publicClient.readContract({
    address: getRegistryAddress(),
    abi: eligibilityRegistryAbi,
    functionName: 'investorStatus',
    args: [investor],
  });
  return Number(status);
}

/**
 * Check if an investor can invest in the pool.
 */
export async function canInvest(
  investor: `0x${string}`
): Promise<{ canInvest: boolean; reason: string }> {
  const publicClient = createSharedPublicClient();
  const [allowed, reason] = await publicClient.readContract({
    address: getRegistryAddress(),
    abi: eligibilityRegistryAbi,
    functionName: 'canInvest',
    args: [investor],
  });
  return { canInvest: allowed, reason };
}

/**
 * Check if an investor has already invested.
 */
export async function hasInvested(investor: `0x${string}`): Promise<boolean> {
  const publicClient = createSharedPublicClient();
  return await publicClient.readContract({
    address: getRegistryAddress(),
    abi: eligibilityRegistryAbi,
    functionName: 'investorHasInvested',
    args: [investor],
  });
}

/**
 * Get registry stats: current non-accredited count and max limit.
 */
export async function getRegistryStats(): Promise<{
  nonAccreditedCount: number;
  maxNonAccredited: number;
}> {
  const publicClient = createSharedPublicClient();
  const [count, max] = await Promise.all([
    publicClient.readContract({
      address: getRegistryAddress(),
      abi: eligibilityRegistryAbi,
      functionName: 'nonAccreditedInvestorCount',
    }),
    publicClient.readContract({
      address: getRegistryAddress(),
      abi: eligibilityRegistryAbi,
      functionName: 'maxNonAccreditedInvestors',
    }),
  ]);
  return {
    nonAccreditedCount: Number(count),
    maxNonAccredited: Number(max),
  };
}
