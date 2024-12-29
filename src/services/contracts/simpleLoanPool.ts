import 'server-only';

import simpleLoanPoolAbi from '../contracts/simpleLoanPool.abi.json';

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
