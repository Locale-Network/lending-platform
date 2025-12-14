import 'server-only';

import simpleLoanPoolAbi from '../contracts/SimpleLoanPool.abi.json';

import { Contract, JsonRpcProvider, keccak256, toUtf8Bytes, Wallet } from 'ethers';
import { rawBalanceOf } from './token';

const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL as string);
const signer = new Wallet(process.env.CARTESI_PRIVATE_KEY as string, provider);

const simpleLoanPool = new Contract(
  process.env.SIMPLE_LOAN_POOL_ADDRESS as string,
  simpleLoanPoolAbi.abi,
  signer
);

export const createLoan = async (
  loanId: string,
  borrower: string,
  amount: number,
  interestRate: number,
  remainingMonths: number
): Promise<void> => {
  const hashedLoanId = keccak256(toUtf8Bytes(loanId));

  console.log('creating loan...');

  const tx = await simpleLoanPool.createLoan(
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
  const tx = await simpleLoanPool.activateLoan(hashedLoanId);

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

    if (!simpleLoanPool.updateLoanInterestRate) {
      throw new Error('updateLoanInterestRate function not found');
    }

    const tx = await simpleLoanPool.updateLoanInterestRate(hashedLoanId, interestRate);

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
    const loanAmount = await simpleLoanPool.loanIdToAmount(hashedLoanId);
    return loanAmount;
  } catch (error) {
    console.error('Error getting loan amount', error);
    return BigInt(0);
  }
}

export async function getLoanInterestRate(loanId: string): Promise<bigint> {
  const hashedLoanId = keccak256(toUtf8Bytes(loanId));
  const interestRate = await simpleLoanPool.loanIdToInterestRate(hashedLoanId);
  return interestRate;
}

export async function getLoanRepaymentAmount(loanId: string): Promise<bigint> {
  const hashedLoanId = keccak256(toUtf8Bytes(loanId));
  const repaymentAmount = await simpleLoanPool.loanIdToRepaymentAmount(hashedLoanId);
  return repaymentAmount;
}

export async function getLoanActive(loanId: string): Promise<boolean> {
  const hashedLoanId = keccak256(toUtf8Bytes(loanId));
  const loanActive = await simpleLoanPool.loanIdToActive(hashedLoanId);
  return loanActive;
}

export async function getLoanRemainingMonths(loanId: string): Promise<bigint> {
  const hashedLoanId = keccak256(toUtf8Bytes(loanId));
  const loanRemainingMonths = await simpleLoanPool.loanIdToRepaymentRemainingMonths(hashedLoanId);
  return loanRemainingMonths;
}

export async function getLoanPoolRemaining(): Promise<bigint> {
  const loanPoolSize = await rawBalanceOf(await simpleLoanPool.getAddress());
  return loanPoolSize;
}

export async function getLoanPoolTotalLentAmount(): Promise<bigint> {
  const loanPoolTotalLentAmount = await simpleLoanPool.totalLentAmount();
  return loanPoolTotalLentAmount;
}
