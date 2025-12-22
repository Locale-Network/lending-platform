import 'server-only';

import creditTreasuryPoolAbi from '../contracts/CreditTreasuryPool.abi.json';

import { Contract, JsonRpcProvider, keccak256, toUtf8Bytes, Wallet } from 'ethers';
import { rawBalanceOf } from './token';

// Lazy initialization to avoid errors during build time when env vars may not be set
let provider: JsonRpcProvider | null = null;
let signer: Wallet | null = null;
let creditTreasuryPoolContract: Contract | null = null;

function getProvider(): JsonRpcProvider {
  if (!provider) {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
    if (!rpcUrl) {
      throw new Error('NEXT_PUBLIC_RPC_URL environment variable is not set');
    }
    provider = new JsonRpcProvider(rpcUrl);
  }
  return provider;
}

function getSigner(): Wallet {
  if (!signer) {
    const privateKey = process.env.CARTESI_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('CARTESI_PRIVATE_KEY environment variable is not set');
    }
    signer = new Wallet(privateKey, getProvider());
  }
  return signer;
}

function getCreditTreasuryPool(): Contract {
  if (!creditTreasuryPoolContract) {
    // Support both old and new env var names for backwards compatibility
    const contractAddress = process.env.CREDIT_TREASURY_POOL_ADDRESS || process.env.SIMPLE_LOAN_POOL_ADDRESS;
    if (!contractAddress) {
      throw new Error('CREDIT_TREASURY_POOL_ADDRESS environment variable is not set');
    }
    creditTreasuryPoolContract = new Contract(
      contractAddress,
      creditTreasuryPoolAbi.abi,
      getSigner()
    );
  }
  return creditTreasuryPoolContract;
}

export const createLoan = async (
  loanId: string,
  borrower: string,
  amount: number,
  interestRate: number,
  remainingMonths: number
): Promise<void> => {
  const hashedLoanId = keccak256(toUtf8Bytes(loanId));
  const contract = getCreditTreasuryPool();

  console.log('creating loan...');

  const tx = await contract.createLoan(
    hashedLoanId,
    borrower,
    amount,
    interestRate,
    remainingMonths
  );

  console.log('loan creation submitted');

  return tx.wait();
};

export const activateLoan = async (loanId: string): Promise<void> => {
  const hashedLoanId = keccak256(toUtf8Bytes(loanId));
  const contract = getCreditTreasuryPool();
  const tx = await contract.activateLoan(hashedLoanId);

  return tx.wait();
};

/**
 * Result from updating a loan interest rate
 */
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
    const hashedLoanId = keccak256(toUtf8Bytes(loanId));
    const contract = getCreditTreasuryPool();

    if (!contract.updateLoanInterestRate) {
      throw new Error('updateLoanInterestRate function not found');
    }

    const tx = await contract.updateLoanInterestRate(hashedLoanId, interestRate);

    const receipt = await tx.wait();
    // Check if the transaction was successful
    if (receipt.status === 0) {
      throw new Error('Transaction failed');
    }

    return {
      success: true,
      txHash: receipt.hash,
    };
  } catch (error) {
    console.error('Error updating loan interest rate', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getLoanAmount(loanId: string): Promise<bigint> {
  try {
    const hashedLoanId = keccak256(toUtf8Bytes(loanId));
    const contract = getCreditTreasuryPool();
    const loanAmount = await contract.loanIdToAmount(hashedLoanId);
    return loanAmount;
  } catch (error) {
    console.error('Error getting loan amount', error);
    return BigInt(0);
  }
}

export async function getLoanInterestRate(loanId: string): Promise<bigint> {
  const hashedLoanId = keccak256(toUtf8Bytes(loanId));
  const contract = getCreditTreasuryPool();
  const interestRate = await contract.loanIdToInterestRate(hashedLoanId);
  return interestRate;
}

export async function getLoanRepaymentAmount(loanId: string): Promise<bigint> {
  const hashedLoanId = keccak256(toUtf8Bytes(loanId));
  const contract = getCreditTreasuryPool();
  const repaymentAmount = await contract.loanIdToRepaymentAmount(hashedLoanId);
  return repaymentAmount;
}

export async function getLoanActive(loanId: string): Promise<boolean> {
  const hashedLoanId = keccak256(toUtf8Bytes(loanId));
  const contract = getCreditTreasuryPool();
  const loanActive = await contract.loanIdToActive(hashedLoanId);
  return loanActive;
}

export async function getLoanRemainingMonths(loanId: string): Promise<bigint> {
  const hashedLoanId = keccak256(toUtf8Bytes(loanId));
  const contract = getCreditTreasuryPool();
  const loanRemainingMonths = await contract.loanIdToRepaymentRemainingMonths(hashedLoanId);
  return loanRemainingMonths;
}

export async function getLoanPoolRemaining(): Promise<bigint> {
  const contract = getCreditTreasuryPool();
  const loanPoolSize = await rawBalanceOf(await contract.getAddress());
  return loanPoolSize;
}

export async function getLoanPoolTotalLentAmount(): Promise<bigint> {
  const contract = getCreditTreasuryPool();
  const loanPoolTotalLentAmount = await contract.totalLentAmount();
  return loanPoolTotalLentAmount;
}

/**
 * Check if a loan exists on-chain by checking if borrower address is set
 * @param loanId The loan application ID (will be hashed)
 * @returns true if loan exists, false otherwise
 */
export async function loanExistsOnChain(loanId: string): Promise<boolean> {
  try {
    const hashedLoanId = keccak256(toUtf8Bytes(loanId));
    const contract = getCreditTreasuryPool();
    const borrower = await contract.loanIdToBorrower(hashedLoanId);
    // If borrower is zero address, loan doesn't exist
    return borrower !== '0x0000000000000000000000000000000000000000';
  } catch (error) {
    console.error('Error checking if loan exists:', error);
    return false;
  }
}

/**
 * Result from recording a loan repayment
 */
export interface RepaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
  isFullyRepaid?: boolean;
}

/**
 * Record a partial loan repayment on-chain
 *
 * This function is called when a borrower makes an ACH payment via Circle
 * and we need to record it on the SimpleLoanPool contract.
 *
 * @param loanId The loan application ID (will be hashed)
 * @param amount The repayment amount in token units (with decimals)
 * @returns Result with success status and transaction hash
 */
export async function makePartialRepayment(
  loanId: string,
  amount: bigint
): Promise<RepaymentResult> {
  try {
    const hashedLoanId = keccak256(toUtf8Bytes(loanId));
    const contract = getCreditTreasuryPool();

    // Check if loan exists and is active
    const isActive = await contract.loanIdToActive(hashedLoanId);
    if (!isActive) {
      return {
        success: false,
        error: 'Loan is not active',
      };
    }

    console.log('[Repayment] Making partial repayment', {
      loanId,
      amount: amount.toString(),
    });

    // Call makePartialRepayment on the contract
    // Note: The contract expects the caller to have approved the token transfer
    // For Circle payments, the funds are already in our treasury, so we transfer from there
    const tx = await contract.makePartialRepayment(hashedLoanId, amount);
    const receipt = await tx.wait();

    if (receipt.status === 0) {
      throw new Error('Transaction failed');
    }

    // Check if loan is now fully repaid
    const stillActive = await contract.loanIdToActive(hashedLoanId);

    console.log('[Repayment] Partial repayment completed', {
      loanId,
      txHash: receipt.hash,
      isFullyRepaid: !stillActive,
    });

    return {
      success: true,
      txHash: receipt.hash,
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

/**
 * Record a full loan repayment on-chain
 *
 * This function is called to fully repay a loan.
 * It calculates the remaining balance and pays it all.
 *
 * @param loanId The loan application ID (will be hashed)
 * @returns Result with success status and transaction hash
 */
export async function makeFullRepayment(loanId: string): Promise<RepaymentResult> {
  try {
    const hashedLoanId = keccak256(toUtf8Bytes(loanId));
    const contract = getCreditTreasuryPool();

    // Check if loan exists and is active
    const isActive = await contract.loanIdToActive(hashedLoanId);
    if (!isActive) {
      return {
        success: false,
        error: 'Loan is not active',
      };
    }

    console.log('[Repayment] Making full repayment', { loanId });

    // Call makeRepayment (full repayment) on the contract
    const tx = await contract.makeRepayment(hashedLoanId);
    const receipt = await tx.wait();

    if (receipt.status === 0) {
      throw new Error('Transaction failed');
    }

    console.log('[Repayment] Full repayment completed', {
      loanId,
      txHash: receipt.hash,
    });

    return {
      success: true,
      txHash: receipt.hash,
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

/**
 * Get remaining balance for a loan
 *
 * @param loanId The loan application ID
 * @returns Remaining balance in token units
 */
export async function getLoanRemainingBalance(loanId: string): Promise<bigint> {
  try {
    const hashedLoanId = keccak256(toUtf8Bytes(loanId));
    const contract = getCreditTreasuryPool();

    // Get the original amount and how much has been repaid
    const originalAmount = await contract.loanIdToAmount(hashedLoanId);
    const repaidAmount = await contract.loanIdToRepaymentAmount(hashedLoanId);

    // Calculate remaining (this is simplified - actual interest calculation may differ)
    return BigInt(originalAmount) - BigInt(repaidAmount);
  } catch (error) {
    console.error('[Repayment] Error getting remaining balance:', error);
    return BigInt(0);
  }
}
