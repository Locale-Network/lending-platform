import 'server-only';

import tokenAbi from '../contracts/UpgradeableCommunityToken.abi.json';

import { Contract, JsonRpcProvider, Wallet } from 'ethers';

const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL as string);
const signer = new Wallet(process.env.CARTESI_PRIVATE_KEY as string, provider);

const token = new Contract(process.env.TOKEN_ADDRESS as string, tokenAbi.abi, provider);

// Minimal ERC20 ABI for token balance queries
const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8', internalType: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
];

// Minimal StakingPool ABI for stakingToken query
const stakingPoolAbi = [
  {
    type: 'function',
    name: 'stakingToken',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
];

// Cache for staking token address to avoid repeated contract calls
let cachedStakingTokenAddress: string | null = null;

/**
 * Get the staking token address from the StakingPool contract
 */
export const getStakingTokenAddress = async (): Promise<string> => {
  if (cachedStakingTokenAddress) {
    return cachedStakingTokenAddress;
  }

  const stakingPoolAddress = process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS;
  if (!stakingPoolAddress) {
    throw new Error('NEXT_PUBLIC_STAKING_POOL_ADDRESS not configured');
  }

  const stakingPool = new Contract(stakingPoolAddress, stakingPoolAbi, provider);
  const tokenAddress: string = await stakingPool.stakingToken();
  cachedStakingTokenAddress = tokenAddress;
  return tokenAddress;
};

/**
 * Get the staking token balance for an address (USDC)
 */
export const getStakingTokenBalance = async (address: string): Promise<number> => {
  const stakingTokenAddress = await getStakingTokenAddress();
  const stakingToken = new Contract(stakingTokenAddress, erc20Abi, provider);

  const balance: bigint = await stakingToken.balanceOf(address);
  const decimals: number = await stakingToken.decimals();

  return Number(balance) / 10 ** decimals;
};

/**
 * Get the staking token symbol (e.g., "USDC")
 */
export const getStakingTokenSymbol = async (): Promise<string> => {
  const stakingTokenAddress = await getStakingTokenAddress();
  const stakingToken = new Contract(stakingTokenAddress, erc20Abi, provider);

  return await stakingToken.symbol();
};

export const rawBalanceOf = async (address: string): Promise<bigint> => {
  const balance: bigint = await token.balanceOf(address);

  return balance;
};

export const balanceOf = async (address: string): Promise<number> => {
  const balance: bigint = await token.balanceOf(address);
  const decimals = await token.decimals();

  return Number(balance) / 10 ** Number(decimals);
};

export const getTokenSymbol = async (): Promise<string> => {
  const symbol = await token.symbol();
  return symbol;
};

export const getTokenDecimals = async (): Promise<number> => {
  const decimals = await token.decimals();
  return Number(decimals);
};
