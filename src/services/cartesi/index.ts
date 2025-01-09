import 'server-only';

import { Contract, Wallet, JsonRpcProvider, getBytes, hexlify } from 'ethers';
import CartesiBase from '@cartesi/rollups/export/abi/base.json';

export const submitInput = async (jsonInput: unknown) => {
  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL as string);

  const signer = new Wallet(process.env.CARTESI_PRIVATE_KEY as string, provider);

  signer.connect(provider);

  const contract = new Contract(
    CartesiBase.contracts.InputBox.address,
    CartesiBase.contracts.InputBox.abi,
    signer
  );

  // Convert context to UTF-8 encoded bytes
  const contextBytes = new TextEncoder().encode(JSON.stringify(jsonInput));

  await contract.addInput(process.env.CARTESI_DAPP_ADDRESS as string, hexlify(contextBytes));
};
