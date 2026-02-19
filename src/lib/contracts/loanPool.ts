/**
 * SimpleLoanPool Contract Configuration
 * Used for frontend wagmi/viem interactions
 */

import { type Address, keccak256, toBytes } from 'viem';

// Contract address from environment
export const LOAN_POOL_ADDRESS = process.env
  .NEXT_PUBLIC_LOAN_POOL_ADDRESS as Address;

// Minimal ABI for frontend interactions (read-only functions users need)
export const loanPoolAbi = [
  // Read functions
  {
    type: 'function',
    name: 'loanIdToAmount',
    inputs: [{ name: '_loanId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'loanIdToActive',
    inputs: [{ name: '_loanId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'loanIdToBorrower',
    inputs: [{ name: '_loanId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'loanIdToInterestRate',
    inputs: [{ name: '_loanId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'loanIdToRepaymentAmount',
    inputs: [{ name: '_loanId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'loanIdToRepaymentRemainingMonths',
    inputs: [{ name: '_loanId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getNextRepayment',
    inputs: [{ name: '_loanId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      { name: '', type: 'uint256', internalType: 'uint256' },
      { name: '', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalLentAmount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'token',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  // Write functions (for borrower repayments)
  {
    type: 'function',
    name: 'makeRepayment',
    inputs: [{ name: '_loanId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'makePartialRepayment',
    inputs: [
      { name: '_loanId', type: 'bytes32', internalType: 'bytes32' },
      { name: '_amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'LoanCreated',
    inputs: [
      { name: 'loanId', type: 'bytes32', indexed: false, internalType: 'bytes32' },
      { name: 'borrower', type: 'address', indexed: false, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'interestRate', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'repaymentRemainingMonths', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'LoanActivated',
    inputs: [
      { name: 'loanId', type: 'bytes32', indexed: false, internalType: 'bytes32' },
      { name: 'borrower', type: 'address', indexed: false, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'LoanRepaymentMade',
    inputs: [
      { name: 'loanId', type: 'bytes32', indexed: false, internalType: 'bytes32' },
      { name: 'borrower', type: 'address', indexed: false, internalType: 'address' },
      { name: 'repaymentAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'interestAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
] as const;

/**
 * Hash a loan ID string to bytes32 for contract interaction
 */
export function hashLoanId(loanId: string): `0x${string}` {
  return keccak256(toBytes(loanId));
}
