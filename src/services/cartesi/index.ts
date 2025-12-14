import 'server-only';

import { Contract, Wallet, JsonRpcProvider, hexlify } from 'ethers';
// Import Cartesi base layer contracts - "base" refers to the settlement layer, not Base network
// The actual chain is determined by NEXT_PUBLIC_RPC_URL in .env
import CartesiBaseLayer from '@cartesi/rollups/export/abi/base.json';

export const submitInput = async (jsonInput: unknown) => {
  // Use CARTESI_RPC_URL for local Anvil, falls back to NEXT_PUBLIC_RPC_URL for production
  const rpcUrl = process.env.CARTESI_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL as string;
  const privateKey = process.env.CARTESI_PRIVATE_KEY as string;
  const dappAddress = process.env.CARTESI_DAPP_ADDRESS as string;
  const inputBoxAddress = CartesiBaseLayer.contracts.InputBox.address;

  // Validate environment variables
  if (!rpcUrl) throw new Error('CARTESI_RPC_URL or NEXT_PUBLIC_RPC_URL must be set');
  if (!privateKey) throw new Error('CARTESI_PRIVATE_KEY is not set');
  if (!dappAddress) throw new Error('CARTESI_DAPP_ADDRESS is not set');

  console.log('[Cartesi] Submitting input:', {
    rpcUrl,
    inputBoxAddress,
    dappAddress,
    inputSize: JSON.stringify(jsonInput).length,
  });

  try {
    const provider = new JsonRpcProvider(rpcUrl);
    const signer = new Wallet(privateKey, provider);

    // Check signer balance
    const balance = await provider.getBalance(signer.address);
    console.log('[Cartesi] Signer address:', signer.address);
    console.log('[Cartesi] Signer balance:', balance.toString(), 'wei');

    if (balance === 0n) {
      throw new Error(`Signer wallet has no ETH for gas. Address: ${signer.address}`);
    }

    const contract = new Contract(
      inputBoxAddress,
      CartesiBaseLayer.contracts.InputBox.abi,
      signer
    );

    // Convert context to UTF-8 encoded bytes
    const contextBytes = new TextEncoder().encode(JSON.stringify(jsonInput));
    const inputHex = hexlify(contextBytes);

    console.log('[Cartesi] Calling addInput with:', {
      dappAddress,
      inputLength: inputHex.length,
    });

    const tx = await contract.addInput(dappAddress, inputHex);
    console.log('[Cartesi] Transaction submitted:', tx.hash);

    const receipt = await tx.wait();
    console.log('[Cartesi] Transaction confirmed:', {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString(),
    });

    return { success: true, txHash: tx.hash };
  } catch (error) {
    console.error('[Cartesi] Error submitting input:', error);
    throw error;
  }
};
