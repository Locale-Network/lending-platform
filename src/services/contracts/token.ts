import 'server-only';

import tokenAbi from '../contracts/UpgradeableCommunityToken.abi.json';

import { Contract, JsonRpcProvider, Wallet } from 'ethers';

const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL as string);
const signer = new Wallet(process.env.CARTESI_PRIVATE_KEY as string, provider);

const token = new Contract(process.env.TOKEN_ADDRESS as string, tokenAbi.abi, provider);

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
