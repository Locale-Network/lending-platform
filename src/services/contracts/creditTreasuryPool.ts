import 'server-only';

import { keccak256, toBytes } from 'viem';
import creditTreasuryPoolAbi from '../contracts/CreditTreasuryPool.abi.json';
import { rawBalanceOf } from './token';
import { assertGasPriceSafe } from '@/lib/contracts/gas-safety';
import { createLoanOpsWalletClient, createSharedPublicClient } from '@/lib/privy/wallet-client';

const abi = creditTreasuryPoolAbi.abi;

function getContractAddress(): `0x${string}` {
  const addr = process.env.CREDIT_TREASURY_POOL_ADDRESS || process.env.SIMPLE_LOAN_POOL_ADDRESS;
  if (!addr) {
    throw new Error('CREDIT_TREASURY_POOL_ADDRESS environment variable is not set');
  }
  return addr as `0x${string}`;
}

function hashLoanId(loanId: string): `0x${string}` {
  return keccak256(toBytes(loanId));
}

// --- Write functions (use Privy server wallet) ---

export const createLoan = async (
  loanId: string,
  borrower: string,
  amount: number,
  interestRate: number,
  remainingMonths: number
): Promise<void> => {
  const hashedLoanId = hashLoanId(loanId);
  const address = getContractAddress();
  const { walletClient, publicClient, account, chain } = createLoanOpsWalletClient();

  await assertGasPriceSafe(() => publicClient.getGasPrice());

  console.log('creating loan...');

  const txHash = await walletClient.writeContract({
    account,
    chain,
    address,
    abi,
    functionName: 'createLoan',
    args: [hashedLoanId, borrower as `0x${string}`, BigInt(amount), BigInt(interestRate), BigInt(remainingMonths)],
  });

  console.log('loan creation submitted');

  await publicClient.waitForTransactionReceipt({ hash: txHash });
};

export const activateLoan = async (loanId: string): Promise<void> => {
  const hashedLoanId = hashLoanId(loanId);
  const address = getContractAddress();
  const { walletClient, publicClient, account, chain } = createLoanOpsWalletClient();

  await assertGasPriceSafe(() => publicClient.getGasPrice());

  const txHash = await walletClient.writeContract({
    chain,
    address,
    abi,
    account,
    functionName: 'activateLoan',
    args: [hashedLoanId],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
};

export interface UpdateLoanRateResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export async function updateLoanInterestRate(
  loanId: string,
  interestRate: bigint
): Promise<UpdateLoanRateResult> {
  try {
    const hashedLoanId = hashLoanId(loanId);
    const address = getContractAddress();
    const { walletClient, publicClient, account, chain } = createLoanOpsWalletClient();

    await assertGasPriceSafe(() => publicClient.getGasPrice());

    const txHash = await walletClient.writeContract({
      account,
      chain,
      address,
      abi,
      functionName: 'updateLoanInterestRate',
      args: [hashedLoanId, interestRate],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
      throw new Error('Transaction failed');
    }

    return { success: true, txHash: receipt.transactionHash };
  } catch (error) {
    console.error('Error updating loan interest rate', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function transferFundsFromPool(
  to: string,
  amount: bigint
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const address = getContractAddress();
    const { walletClient, publicClient, account, chain } = createLoanOpsWalletClient();

    await assertGasPriceSafe(() => publicClient.getGasPrice());

    const txHash = await walletClient.writeContract({
      account,
      chain,
      address,
      abi,
      functionName: 'transferFunds',
      args: [to as `0x${string}`, amount],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
      throw new Error('Transaction failed on-chain');
    }

    return { success: true, txHash: receipt.transactionHash };
  } catch (error) {
    console.error('transferFundsFromPool failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export interface RepaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
  isFullyRepaid?: boolean;
}

export async function makePartialRepayment(
  loanId: string,
  amount: bigint
): Promise<RepaymentResult> {
  try {
    const hashedLoanId = hashLoanId(loanId);
    const address = getContractAddress();
    const publicClient = createSharedPublicClient();

    // Check if loan exists and is active
    const isActive = await publicClient.readContract({
      address,
      abi,
      functionName: 'loanIdToActive',
      args: [hashedLoanId],
    });
    if (!isActive) {
      return { success: false, error: 'Loan is not active' };
    }

    const { walletClient, publicClient: walletPublicClient, account, chain } = createLoanOpsWalletClient();

    await assertGasPriceSafe(() => walletPublicClient.getGasPrice());

    console.log('[Repayment] Making partial repayment', {
      loanId,
      amount: amount.toString(),
    });

    const txHash = await walletClient.writeContract({
      account,
      chain,
      address,
      abi,
      functionName: 'makePartialRepayment',
      args: [hashedLoanId, amount],
    });

    const receipt = await walletPublicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
      throw new Error('Transaction failed');
    }

    // Check if loan is now fully repaid
    const stillActive = await publicClient.readContract({
      address,
      abi,
      functionName: 'loanIdToActive',
      args: [hashedLoanId],
    });

    console.log('[Repayment] Partial repayment completed', {
      loanId,
      txHash: receipt.transactionHash,
      isFullyRepaid: !stillActive,
    });

    return {
      success: true,
      txHash: receipt.transactionHash,
      isFullyRepaid: !stillActive,
    };
  } catch (error) {
    console.error('[Repayment] Error making partial repayment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function makeFullRepayment(loanId: string): Promise<RepaymentResult> {
  try {
    const hashedLoanId = hashLoanId(loanId);
    const address = getContractAddress();
    const publicClient = createSharedPublicClient();

    // Check if loan exists and is active
    const isActive = await publicClient.readContract({
      address,
      abi,
      functionName: 'loanIdToActive',
      args: [hashedLoanId],
    });
    if (!isActive) {
      return { success: false, error: 'Loan is not active' };
    }

    const { walletClient, publicClient: walletPublicClient, account, chain } = createLoanOpsWalletClient();

    await assertGasPriceSafe(() => walletPublicClient.getGasPrice());

    console.log('[Repayment] Making full repayment', { loanId });

    const txHash = await walletClient.writeContract({
      account,
      chain,
      address,
      abi,
      functionName: 'makeRepayment',
      args: [hashedLoanId],
    });

    const receipt = await walletPublicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== 'success') {
      throw new Error('Transaction failed');
    }

    console.log('[Repayment] Full repayment completed', {
      loanId,
      txHash: receipt.transactionHash,
    });

    return {
      success: true,
      txHash: receipt.transactionHash,
      isFullyRepaid: true,
    };
  } catch (error) {
    console.error('[Repayment] Error making full repayment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// --- Read-only functions (use shared public client) ---

export async function getLoanAmount(loanId: string): Promise<bigint> {
  try {
    const hashedLoanId = hashLoanId(loanId);
    const publicClient = createSharedPublicClient();
    return await publicClient.readContract({
      address: getContractAddress(),
      abi,
      functionName: 'loanIdToAmount',
      args: [hashedLoanId],
    }) as bigint;
  } catch (error) {
    console.error('Error getting loan amount', error);
    return BigInt(0);
  }
}

export async function getLoanInterestRate(loanId: string): Promise<bigint> {
  const hashedLoanId = hashLoanId(loanId);
  const publicClient = createSharedPublicClient();
  return await publicClient.readContract({
    address: getContractAddress(),
    abi,
    functionName: 'loanIdToInterestRate',
    args: [hashedLoanId],
  }) as bigint;
}

export async function getLoanRepaymentAmount(loanId: string): Promise<bigint> {
  const hashedLoanId = hashLoanId(loanId);
  const publicClient = createSharedPublicClient();
  return await publicClient.readContract({
    address: getContractAddress(),
    abi,
    functionName: 'loanIdToRepaymentAmount',
    args: [hashedLoanId],
  }) as bigint;
}

export async function getLoanActive(loanId: string): Promise<boolean> {
  const hashedLoanId = hashLoanId(loanId);
  const publicClient = createSharedPublicClient();
  return await publicClient.readContract({
    address: getContractAddress(),
    abi,
    functionName: 'loanIdToActive',
    args: [hashedLoanId],
  }) as boolean;
}

export async function getLoanInterestAmount(loanId: string): Promise<bigint> {
  try {
    const hashedLoanId = hashLoanId(loanId);
    const publicClient = createSharedPublicClient();
    return await publicClient.readContract({
      address: getContractAddress(),
      abi,
      functionName: 'loanIdToInterestAmount',
      args: [hashedLoanId],
    }) as bigint;
  } catch (error) {
    console.error('Error getting loan interest amount', error);
    return BigInt(0);
  }
}

export async function getLoanRemainingMonths(loanId: string): Promise<bigint> {
  const hashedLoanId = hashLoanId(loanId);
  const publicClient = createSharedPublicClient();
  return await publicClient.readContract({
    address: getContractAddress(),
    abi,
    functionName: 'loanIdToRepaymentRemainingMonths',
    args: [hashedLoanId],
  }) as bigint;
}

export async function getLoanPoolRemaining(): Promise<bigint> {
  return rawBalanceOf(getContractAddress());
}

export async function getLoanPoolTotalLentAmount(): Promise<bigint> {
  const publicClient = createSharedPublicClient();
  return await publicClient.readContract({
    address: getContractAddress(),
    abi,
    functionName: 'totalLentAmount',
  }) as bigint;
}

export async function loanExistsOnChain(loanId: string): Promise<boolean> {
  try {
    const hashedLoanId = hashLoanId(loanId);
    const publicClient = createSharedPublicClient();
    const borrower = await publicClient.readContract({
      address: getContractAddress(),
      abi,
      functionName: 'loanIdToBorrower',
      args: [hashedLoanId],
    }) as `0x${string}`;
    return borrower !== '0x0000000000000000000000000000000000000000';
  } catch (error) {
    console.error('Error checking if loan exists:', error);
    return false;
  }
}

export async function getLoanRemainingBalance(loanId: string): Promise<bigint> {
  try {
    const hashedLoanId = hashLoanId(loanId);
    const publicClient = createSharedPublicClient();
    const address = getContractAddress();

    const originalAmount = await publicClient.readContract({
      address,
      abi,
      functionName: 'loanIdToAmount',
      args: [hashedLoanId],
    }) as bigint;

    const repaidAmount = await publicClient.readContract({
      address,
      abi,
      functionName: 'loanIdToRepaymentAmount',
      args: [hashedLoanId],
    }) as bigint;

    return originalAmount - repaidAmount;
  } catch (error) {
    console.error('[Repayment] Error getting remaining balance:', error);
    return BigInt(0);
  }
}
