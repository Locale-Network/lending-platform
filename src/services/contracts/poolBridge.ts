import 'server-only';

import { Contract, JsonRpcProvider, Wallet, EventLog } from 'ethers';
import { stakingPoolAbi, erc20Abi } from '@/lib/contracts/stakingPool';
import prisma from '@prisma/index';
import { getEthersGasOverrides } from '@/lib/contracts/gas-safety';
import { USDC_UNIT } from '@/lib/constants/business';

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

// Lazy initialization
let _provider: JsonRpcProvider | null = null;
let _signer: Wallet | null = null;
let _stakingPool: Contract | null = null;
let _token: Contract | null = null;

function getProvider(): JsonRpcProvider {
  if (!_provider) {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
    if (!rpcUrl) {
      throw new Error('NEXT_PUBLIC_RPC_URL not configured');
    }
    _provider = new JsonRpcProvider(rpcUrl);
  }
  return _provider;
}

function getSigner(): Wallet {
  if (!_signer) {
    const privateKey = process.env.POOL_ADMIN_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('POOL_ADMIN_PRIVATE_KEY not configured');
    }
    _signer = new Wallet(privateKey, getProvider());
  }
  return _signer;
}

function getStakingPool(): Contract {
  if (!_stakingPool) {
    const address = process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS;
    if (!address) {
      throw new Error('NEXT_PUBLIC_STAKING_POOL_ADDRESS not configured');
    }
    _stakingPool = new Contract(address, stakingPoolAbi, getSigner());
  }
  return _stakingPool;
}

function getToken(): Contract {
  if (!_token) {
    const address = process.env.NEXT_PUBLIC_TOKEN_ADDRESS;
    if (!address) {
      throw new Error('NEXT_PUBLIC_TOKEN_ADDRESS not configured');
    }
    _token = new Contract(address, erc20Abi, getSigner());
  }
  return _token;
}

export function getPoolAdminAddress(): string {
  return getSigner().address;
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
    const stakingPool = getStakingPool();
    const simpleLoanPoolAddress = process.env.SIMPLE_LOAN_POOL_ADDRESS;

    if (!simpleLoanPoolAddress) {
      throw new Error('SIMPLE_LOAN_POOL_ADDRESS not configured');
    }

    // Check gas price before submitting
    const gasOverrides = await getEthersGasOverrides(getProvider());

    // Execute transfer
    const tx = await stakingPool.transferToLoanPool(amount, simpleLoanPoolAddress, gasOverrides);
    const receipt = await tx.wait();

    if (receipt.status === 0) {
      throw new Error('Transaction failed on-chain');
    }

    // Record in database
    await prisma.poolTransfer.create({
      data: {
        fromPool: 'staking',
        toPool: 'loan',
        amount,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        initiatedBy,
        status: 'COMPLETED',
      },
    });

    return {
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    console.error('transferToLoanPool failed:', error);
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
    const stakingPool = getStakingPool();
    const token = getToken();
    const signer = getSigner();
    const stakingPoolAddress = await stakingPool.getAddress();

    // Check gas price before submitting
    const gasOverrides = await getEthersGasOverrides(getProvider());

    // Approve StakingPool to spend tokens for yield distribution
    const allowance = await token.allowance(signer.address, stakingPoolAddress);
    if (allowance < amount) {
      const approveTx = await token.approve(stakingPoolAddress, amount, gasOverrides);
      await approveTx.wait();
    }

    // Distribute yield
    const tx = await stakingPool.distributeYield(contractPoolId, amount, gasOverrides);
    const receipt = await tx.wait();

    if (receipt.status === 0) {
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
        distributionTxHash: receipt.hash,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    console.error('distributeYield failed:', error);
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
    const stakingPool = getStakingPool();
    const gasOverrides = await getEthersGasOverrides(getProvider());

    const tx = await stakingPool.setPoolCooldownWaived(contractPoolId, waived, gasOverrides);
    const receipt = await tx.wait();

    if (receipt.status === 0) {
      throw new Error('Transaction failed on-chain');
    }

    return {
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    console.error('setPoolCooldownWaived failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get balance of StakingPool
 */
export async function getStakingPoolBalance(): Promise<bigint> {
  const token = getToken();
  const stakingPoolAddress = process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS;
  if (!stakingPoolAddress) {
    throw new Error('NEXT_PUBLIC_STAKING_POOL_ADDRESS not configured');
  }
  return token.balanceOf(stakingPoolAddress);
}

/**
 * Get balance of SimpleLoanPool
 */
export async function getSimpleLoanPoolBalance(): Promise<bigint> {
  const token = getToken();
  const simpleLoanPoolAddress = process.env.SIMPLE_LOAN_POOL_ADDRESS;
  if (!simpleLoanPoolAddress) {
    throw new Error('SIMPLE_LOAN_POOL_ADDRESS not configured');
  }
  return token.balanceOf(simpleLoanPoolAddress);
}

/**
 * Get total transferred to loan pool from StakingPool contract
 */
export async function getTotalTransferredToLoanPool(): Promise<bigint> {
  const stakingPool = getStakingPool();
  return stakingPool.totalTransferredToLoanPool();
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
  const provider = getProvider();
  const simpleLoanPoolAddress = process.env.SIMPLE_LOAN_POOL_ADDRESS;

  if (!simpleLoanPoolAddress) {
    throw new Error('SIMPLE_LOAN_POOL_ADDRESS not configured');
  }

  // LoanRepaymentMade event ABI
  const loanRepaymentAbi = [
    {
      type: 'event',
      name: 'LoanRepaymentMade',
      inputs: [
        { name: 'loanId', type: 'bytes32', indexed: false },
        { name: 'borrower', type: 'address', indexed: false },
        { name: 'repaymentAmount', type: 'uint256', indexed: false },
        { name: 'interestAmount', type: 'uint256', indexed: false },
      ],
    },
  ];

  const simpleLoanPool = new Contract(
    simpleLoanPoolAddress,
    loanRepaymentAbi,
    provider
  );

  const filter = simpleLoanPool.filters.LoanRepaymentMade();
  const events = await simpleLoanPool.queryFilter(filter, fromBlock, toBlock);

  return events
    .filter((e): e is EventLog => 'args' in e)
    .map((event) => ({
      loanId: event.args[0],
      borrower: event.args[1],
      repaymentAmount: event.args[2],
      interestAmount: event.args[3],
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
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
    // Default to deployment block or a reasonable starting point
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
  const provider = getProvider();
  return provider.getBlockNumber();
}
