/**
 * StakingPool Contract Configuration
 * Used for frontend wagmi/viem interactions
 */

import { type Address, keccak256, toBytes } from 'viem';

// Contract address from environment
export const STAKING_POOL_ADDRESS = process.env
  .NEXT_PUBLIC_STAKING_POOL_ADDRESS as Address;

// Minimal ABI for frontend interactions
export const stakingPoolAbi = [
  // Read functions
  {
    type: 'function',
    name: 'stakingToken',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cooldownPeriod',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'feeRecipient',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minimumUnstakeAmount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPool',
    inputs: [{ name: '_poolId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      { name: 'name', type: 'string', internalType: 'string' },
      { name: 'minimumStake', type: 'uint256', internalType: 'uint256' },
      { name: 'totalStaked', type: 'uint256', internalType: 'uint256' },
      { name: 'totalShares', type: 'uint256', internalType: 'uint256' },
      { name: 'feeRate', type: 'uint256', internalType: 'uint256' },
      { name: 'active', type: 'bool', internalType: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getUserStake',
    inputs: [
      { name: '_poolId', type: 'bytes32', internalType: 'bytes32' },
      { name: '_user', type: 'address', internalType: 'address' },
    ],
    outputs: [
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'shares', type: 'uint256', internalType: 'uint256' },
      { name: 'stakedAt', type: 'uint256', internalType: 'uint256' },
      { name: 'pendingUnstake', type: 'uint256', internalType: 'uint256' },
      { name: 'canWithdrawAt', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getStakeValue',
    inputs: [
      { name: '_poolId', type: 'bytes32', internalType: 'bytes32' },
      { name: '_user', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAllPoolIds',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32[]', internalType: 'bytes32[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPoolCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  // Write functions
  {
    type: 'function',
    name: 'stake',
    inputs: [
      { name: '_poolId', type: 'bytes32', internalType: 'bytes32' },
      { name: '_amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'requestUnstake',
    inputs: [
      { name: '_poolId', type: 'bytes32', internalType: 'bytes32' },
      { name: '_amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'completeUnstake',
    inputs: [{ name: '_poolId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancelUnstake',
    inputs: [{ name: '_poolId', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Admin functions (for server-side deployment)
  {
    type: 'function',
    name: 'createPool',
    inputs: [
      { name: '_poolId', type: 'bytes32', internalType: 'bytes32' },
      { name: '_name', type: 'string', internalType: 'string' },
      { name: '_minimumStake', type: 'uint256', internalType: 'uint256' },
      { name: '_feeRate', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'PoolCreated',
    inputs: [
      { name: 'poolId', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'name', type: 'string', indexed: false, internalType: 'string' },
      { name: 'minimumStake', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'feeRate', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'Staked',
    inputs: [
      { name: 'poolId', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'user', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'shares', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'fee', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'UnstakeRequested',
    inputs: [
      { name: 'poolId', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'user', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'unlockTime', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'Unstaked',
    inputs: [
      { name: 'poolId', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'user', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
  },
] as const;

// ERC20 approval ABI (for token approval before staking)
export const erc20Abi = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address', internalType: 'address' },
      { name: 'spender', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

/**
 * Hash a pool ID string to bytes32 for contract interaction
 */
export function hashPoolId(poolId: string): `0x${string}` {
  return keccak256(toBytes(poolId));
}

/**
 * Pool data structure returned from contract
 */
export interface PoolData {
  name: string;
  minimumStake: bigint;
  totalStaked: bigint;
  totalShares: bigint;
  feeRate: bigint;
  active: boolean;
}

/**
 * User stake data structure returned from contract
 */
export interface UserStakeData {
  amount: bigint;
  shares: bigint;
  stakedAt: bigint;
  pendingUnstake: bigint;
  canWithdrawAt: bigint;
}
