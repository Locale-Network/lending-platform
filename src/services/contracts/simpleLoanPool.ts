import 'server-only';

import simpleLoanPoolAbi from '../contracts/SimpleLoanPool.abi.json';

import { Contract, JsonRpcProvider, keccak256, toUtf8Bytes, Wallet } from 'ethers';
import { rawBalanceOf } from './token';

// Lazy initialization to avoid errors during build time when env vars may not be set
let provider: JsonRpcProvider | null = null;
let signer: Wallet | null = null;
let simpleLoanPoolContract: Contract | null = null;

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

function getSimpleLoanPool(): Contract {
  if (!simpleLoanPoolContract) {
    const contractAddress = process.env.SIMPLE_LOAN_POOL_ADDRESS;
    if (!contractAddress) {
      throw new Error('SIMPLE_LOAN_POOL_ADDRESS environment variable is not set');
    }
    simpleLoanPoolContract = new Contract(
      contractAddress,
      simpleLoanPoolAbi.abi,
      getSigner()
    );
  }
  return simpleLoanPoolContract;
}

export const createLoan = async (
  loanId: string,
  borrower: string,
  amount: number,
  interestRate: number,
  remainingMonths: number
): Promise<void> => {
  const hashedLoanId = keccak256(toUtf8Bytes(loanId));
  const contract = getSimpleLoanPool();

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
  const contract = getSimpleLoanPool();
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
    const contract = getSimpleLoanPool();

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
    const contract = getSimpleLoanPool();
    const loanAmount = await contract.loanIdToAmount(hashedLoanId);
    return loanAmount;
  } catch (error) {
    console.error('Error getting loan amount', error);
    return BigInt(0);
  }
}

export async function getLoanInterestRate(loanId: string): Promise<bigint> {
  const hashedLoanId = keccak256(toUtf8Bytes(loanId));
  const contract = getSimpleLoanPool();
  const interestRate = await contract.loanIdToInterestRate(hashedLoanId);
  return interestRate;
}

export async function getLoanRepaymentAmount(loanId: string): Promise<bigint> {
  const hashedLoanId = keccak256(toUtf8Bytes(loanId));
  const contract = getSimpleLoanPool();
  const repaymentAmount = await contract.loanIdToRepaymentAmount(hashedLoanId);
  return repaymentAmount;
}

export async function getLoanActive(loanId: string): Promise<boolean> {
  const hashedLoanId = keccak256(toUtf8Bytes(loanId));
  const contract = getSimpleLoanPool();
  const loanActive = await contract.loanIdToActive(hashedLoanId);
  return loanActive;
}

export async function getLoanRemainingMonths(loanId: string): Promise<bigint> {
  const hashedLoanId = keccak256(toUtf8Bytes(loanId));
  const contract = getSimpleLoanPool();
  const loanRemainingMonths = await contract.loanIdToRepaymentRemainingMonths(hashedLoanId);
  return loanRemainingMonths;
}

export async function getLoanPoolRemaining(): Promise<bigint> {
  const contract = getSimpleLoanPool();
  const loanPoolSize = await rawBalanceOf(await contract.getAddress());
  return loanPoolSize;
}

export async function getLoanPoolTotalLentAmount(): Promise<bigint> {
  const contract = getSimpleLoanPool();
  const loanPoolTotalLentAmount = await contract.totalLentAmount();
  return loanPoolTotalLentAmount;
}
