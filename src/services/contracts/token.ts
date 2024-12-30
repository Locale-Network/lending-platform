import 'server-only';

import tokenAbi from '../contracts/UpgradeableCommunityToken.abi.json';

import { Contract, JsonRpcProvider, Wallet } from 'ethers';

const provider = new JsonRpcProvider(process.env.CARTESI_RPC_URL as string);
const signer = new Wallet(process.env.CARTESI_PRIVATE_KEY as string, provider);

const token = new Contract(process.env.TOKEN_ADDRESS as string, tokenAbi.abi, provider);

export const balanceOf = async (address: string): Promise<number> => {
  const balance: bigint = await token.balanceOf(address);

  return Number(balance) / 10 ** 4;
};
