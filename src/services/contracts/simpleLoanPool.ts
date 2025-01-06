import 'server-only';

import simpleLoanPoolAbi from '../contracts/SimpleLoanPool.abi.json';

import { Contract, JsonRpcProvider, keccak256, toUtf8Bytes, Wallet } from 'ethers';

const provider = new JsonRpcProvider(process.env.CARTESI_RPC_URL as string);
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

  const tx = await simpleLoanPool.createLoan(
    hashedLoanId,
    borrower,
    amount,
    interestRate,
    remainingMonths
  );

  return tx.wait();
};

export const activateLoan = async (loanId: string): Promise<void> => {
  const hashedLoanId = keccak256(toUtf8Bytes(loanId));
  const tx = await simpleLoanPool.activateLoan(hashedLoanId);

  return tx.wait();
};

export async function updateLoanInterestRate(
  loanId: string,
  interestRate: bigint
): Promise<boolean> {
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

    return true;
  } catch (error) {
    console.error('Error updating loan interest rate', error);
    return false;
  }
}

export async function getLoanAmount(loanId: string): Promise<bigint> {
  const hashedLoanId = keccak256(toUtf8Bytes(loanId));
  const loanAmount = await simpleLoanPool.loanAmounts(hashedLoanId);
  return loanAmount;
}
