import 'server-only';

import { parseAbiItem } from 'viem';
import { stakingPoolAbi, erc20Abi } from '@/lib/contracts/stakingPool';
import prisma from '@prisma/index';
import { assertGasPriceSafe } from '@/lib/contracts/gas-safety';
import { USDC_UNIT } from '@/lib/constants/business';
import {
  createPoolAdminWalletClient,
  createSharedPublicClient,
  getPoolAdminWalletAddress,
} from '@/lib/privy/wallet-client';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'pool-bridge' });

/**
 * Pool Bridge Service
 *
 * Handles fund transfers between StakingPool and SimpleLoanPool,
 * and yield distribution from loan repayments to investors.
 *
 * Key Functions:
 * 1. transferToLoanPool() - Move funds from StakingPool to SimpleLoanPool
 * 2. distributeYield() - Distribute interest earnings to pool investors
 * 3. queryRepaymentEvents() - Index LoanRepaymentMade events
 */

function getStakingPoolAddress(): `0x${string}` {
  const addr = process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS;
  if (!addr) throw new Error('NEXT_PUBLIC_STAKING_POOL_ADDRESS not configured');
  return addr as `0x${string}`;
}

function getTokenAddress(): `0x${string}` {
  const addr = process.env.NEXT_PUBLIC_TOKEN_ADDRESS;
  if (!addr) throw new Error('NEXT_PUBLIC_TOKEN_ADDRESS not configured');
  return addr as `0x${string}`;
}

function getSimpleLoanPoolAddress(): `0x${string}` {
  const addr = process.env.SIMPLE_LOAN_POOL_ADDRESS;
  if (!addr) throw new Error('SIMPLE_LOAN_POOL_ADDRESS not configured');
  return addr as `0x${string}`;
}

export function getPoolAdminAddress(): string {
  return getPoolAdminWalletAddress();
}

export interface TransferResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  error?: string;
}

/**
 * Transfer funds from StakingPool to SimpleLoanPool for loan disbursement
 */
export async function transferToLoanPool(
  amount: bigint,
  initiatedBy: string
): Promise<TransferResult> {
  try {
    const stakingPoolAddress = getStakingPoolAddress();
    const simpleLoanPoolAddress = getSimpleLoanPoolAddress();
    const { walletClient, publicClient, account, chain } = createPoolAdminWalletClient();

    await assertGasPriceSafe(() => publicClient.getGasPrice());

    await publicClient.simulateContract({
      account,
      address: stakingPoolAddress,
      abi: stakingPoolAbi,
      functionName: 'transferToLoanPool',
      args: [amount, simpleLoanPoolAddress],
    });

    const txHash = await walletClient.writeContract({
      account,
      chain,
      address: stakingPoolAddress,
      abi: stakingPoolAbi,
      functionName: 'transferToLoanPool',
      args: [amount, simpleLoanPoolAddress],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000, pollingInterval: 2_000 });
    if (receipt.status !== 'success') {
      throw new Error('Transaction failed on-chain');
    }

    // Record in database
    await prisma.poolTransfer.create({
      data: {
        fromPool: 'staking',
        toPool: 'loan',
        amount,
        transactionHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        initiatedBy,
        status: 'COMPLETED',
      },
    });

    return {
      success: true,
      txHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber),
    };
  } catch (error) {
    log.error({ err: error }, 'transferToLoanPool failed');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export interface DistributeYieldResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  error?: string;
}

/**
 * Distribute yield to a staking pool
 * The caller must have approved the StakingPool to spend the yield amount
 */
export async function distributeYield(
  poolId: string,
  contractPoolId: string,
  amount: bigint,
  loanApplicationId?: string,
  principalAmount: bigint = BigInt(0),
  sourceBlockNumber: number = 0
): Promise<DistributeYieldResult> {
  try {
    const stakingPoolAddress = getStakingPoolAddress();
    const tokenAddress = getTokenAddress();
    const { walletClient, publicClient, account, chain } = createPoolAdminWalletClient();

    await assertGasPriceSafe(() => publicClient.getGasPrice());

    // Check allowance and approve if needed
    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account.address, stakingPoolAddress],
    }) as bigint;

    if (allowance < amount) {
      const approveTxHash = await walletClient.writeContract({
        account,
        chain,
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [stakingPoolAddress, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTxHash, timeout: 120_000, pollingInterval: 2_000 });
    }

    // Distribute yield
    await publicClient.simulateContract({
      account,
      address: stakingPoolAddress,
      abi: stakingPoolAbi,
      functionName: 'distributeYield',
      args: [contractPoolId as `0x${string}`, amount],
    });

    const txHash = await walletClient.writeContract({
      account,
      chain,
      address: stakingPoolAddress,
      abi: stakingPoolAbi,
      functionName: 'distributeYield',
      args: [contractPoolId as `0x${string}`, amount],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000, pollingInterval: 2_000 });
    if (receipt.status !== 'success') {
      throw new Error('Transaction failed on-chain');
    }

    // Record in database
    await prisma.yieldDistribution.create({
      data: {
        poolId,
        contractPoolId,
        loanApplicationId,
        principalAmount,
        interestAmount: amount,
        totalAmount: amount + principalAmount,
        sourceBlockNumber,
        distributionTxHash: receipt.transactionHash,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      txHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber),
    };
  } catch (error) {
    log.error({ err: error }, 'distributeYield failed');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Waive or restore cooldown period for a pool on StakingPool contract
 * When waived, investors can unstake immediately without waiting for cooldown
 */
export async function setPoolCooldownWaived(
  contractPoolId: string,
  waived: boolean
): Promise<TransferResult> {
  try {
    const stakingPoolAddress = getStakingPoolAddress();
    const { walletClient, publicClient, account, chain } = createPoolAdminWalletClient();

    await assertGasPriceSafe(() => publicClient.getGasPrice());

    await publicClient.simulateContract({
      account,
      address: stakingPoolAddress,
      abi: stakingPoolAbi,
      functionName: 'setPoolCooldownWaived',
      args: [contractPoolId as `0x${string}`, waived],
    });

    const txHash = await walletClient.writeContract({
      account,
      chain,
      address: stakingPoolAddress,
      abi: stakingPoolAbi,
      functionName: 'setPoolCooldownWaived',
      args: [contractPoolId as `0x${string}`, waived],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000, pollingInterval: 2_000 });
    if (receipt.status !== 'success') {
      throw new Error('Transaction failed on-chain');
    }

    return {
      success: true,
      txHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber),
    };
  } catch (error) {
    log.error({ err: error }, 'setPoolCooldownWaived failed');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// --- Read-only functions ---

/**
 * Get balance of StakingPool
 */
export async function getStakingPoolBalance(): Promise<bigint> {
  const publicClient = createSharedPublicClient();
  return await publicClient.readContract({
    address: getTokenAddress(),
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [getStakingPoolAddress()],
  }) as bigint;
}

/**
 * Get balance of SimpleLoanPool
 */
export async function getSimpleLoanPoolBalance(): Promise<bigint> {
  const publicClient = createSharedPublicClient();
  return await publicClient.readContract({
    address: getTokenAddress(),
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [getSimpleLoanPoolAddress()],
  }) as bigint;
}

/**
 * Get total transferred to loan pool from StakingPool contract
 */
export async function getTotalTransferredToLoanPool(): Promise<bigint> {
  const publicClient = createSharedPublicClient();
  return await publicClient.readContract({
    address: getStakingPoolAddress(),
    abi: stakingPoolAbi,
    functionName: 'totalTransferredToLoanPool',
  }) as bigint;
}

/**
 * Get pool balances summary
 */
export async function getPoolBalancesSummary(): Promise<{
  stakingPoolBalance: string;
  simpleLoanPoolBalance: string;
  totalTransferred: string;
}> {
  const [stakingBalance, loanBalance, totalTransferred] = await Promise.all([
    getStakingPoolBalance(),
    getSimpleLoanPoolBalance(),
    getTotalTransferredToLoanPool(),
  ]);

  return {
    stakingPoolBalance: (stakingBalance / USDC_UNIT).toString(),
    simpleLoanPoolBalance: (loanBalance / USDC_UNIT).toString(),
    totalTransferred: (totalTransferred / USDC_UNIT).toString(),
  };
}

const loanRepaymentEvent = parseAbiItem(
  'event LoanRepaymentMade(bytes32 loanId, address borrower, uint256 repaymentAmount, uint256 interestAmount)'
);

/**
 * Query LoanRepaymentMade events from SimpleLoanPool
 * Used by yield distribution cron to find new repayments
 */
export async function queryLoanRepaymentEvents(
  fromBlock: number,
  toBlock: number | 'latest'
): Promise<
  Array<{
    loanId: string;
    borrower: string;
    repaymentAmount: bigint;
    interestAmount: bigint;
    blockNumber: number;
    transactionHash: string;
  }>
> {
  const publicClient = createSharedPublicClient();
  const simpleLoanPoolAddress = getSimpleLoanPoolAddress();

  const logs = await publicClient.getLogs({
    address: simpleLoanPoolAddress,
    event: loanRepaymentEvent,
    fromBlock: BigInt(fromBlock),
    toBlock: toBlock === 'latest' ? undefined : BigInt(toBlock),
  });

  return logs.map((log) => ({
    loanId: log.args.loanId!,
    borrower: log.args.borrower!,
    repaymentAmount: log.args.repaymentAmount!,
    interestAmount: log.args.interestAmount!,
    blockNumber: Number(log.blockNumber),
    transactionHash: log.transactionHash,
  }));
}

/**
 * Get the last processed block for yield distribution
 */
export async function getLastYieldDistributionBlock(): Promise<number> {
  const state = await prisma.indexerState.findUnique({
    where: { key: 'yield_distribution_last_block' },
  });

  if (!state) {
    const deployedAtBlock = parseInt(
      process.env.SIMPLE_LOAN_POOL_DEPLOYED_BLOCK || '0'
    );
    return deployedAtBlock;
  }

  return parseInt(state.value);
}

/**
 * Update the last processed block for yield distribution
 */
export async function setLastYieldDistributionBlock(
  blockNumber: number
): Promise<void> {
  await prisma.indexerState.upsert({
    where: { key: 'yield_distribution_last_block' },
    update: { value: blockNumber.toString() },
    create: {
      key: 'yield_distribution_last_block',
      value: blockNumber.toString(),
    },
  });
}

/**
 * Get current block number from provider
 */
export async function getCurrentBlockNumber(): Promise<number> {
  const publicClient = createSharedPublicClient();
  return Number(await publicClient.getBlockNumber());
}
