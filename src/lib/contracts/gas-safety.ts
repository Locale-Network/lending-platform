import 'server-only';

/**
 * Gas price safety limits for on-chain transactions.
 *
 * Prevents accidental overspend during gas spikes.
 * All values in wei.
 */

// 50 gwei — refuse to submit if gas exceeds this
const MAX_GAS_PRICE_WEI = BigInt(50_000_000_000);

/**
 * Check current gas price against the safety cap.
 * Throws if the network gas price exceeds MAX_GAS_PRICE_WEI.
 *
 * Works with both ethers JsonRpcProvider and viem publicClient.
 */
export async function assertGasPriceSafe(
  getGasPrice: () => Promise<bigint>
): Promise<void> {
  const gasPrice = await getGasPrice();
  if (gasPrice > MAX_GAS_PRICE_WEI) {
    const gasPriceGwei = Number(gasPrice) / 1e9;
    const maxGwei = Number(MAX_GAS_PRICE_WEI) / 1e9;
    throw new Error(
      `Gas price ${gasPriceGwei.toFixed(1)} gwei exceeds safety cap of ${maxGwei} gwei. ` +
      `Transaction not submitted to avoid excessive cost.`
    );
  }
}

/**
 * Returns ethers transaction overrides with gas cap.
 * Use as: await contract.someMethod(arg1, arg2, await getEthersGasOverrides(provider))
 */
export async function getEthersGasOverrides(
  provider: { getFeeData: () => Promise<{ gasPrice: bigint | null; maxFeePerGas: bigint | null }> }
): Promise<{ maxFeePerGas?: bigint; gasPrice?: bigint }> {
  const feeData = await provider.getFeeData();

  // EIP-1559 chain
  if (feeData.maxFeePerGas !== null) {
    if (feeData.maxFeePerGas > MAX_GAS_PRICE_WEI) {
      const gwei = Number(feeData.maxFeePerGas) / 1e9;
      const maxGwei = Number(MAX_GAS_PRICE_WEI) / 1e9;
      throw new Error(
        `Gas price ${gwei.toFixed(1)} gwei exceeds safety cap of ${maxGwei} gwei.`
      );
    }
    return { maxFeePerGas: MAX_GAS_PRICE_WEI };
  }

  // Legacy chain
  if (feeData.gasPrice !== null) {
    if (feeData.gasPrice > MAX_GAS_PRICE_WEI) {
      const gwei = Number(feeData.gasPrice) / 1e9;
      const maxGwei = Number(MAX_GAS_PRICE_WEI) / 1e9;
      throw new Error(
        `Gas price ${gwei.toFixed(1)} gwei exceeds safety cap of ${maxGwei} gwei.`
      );
    }
    return { gasPrice: MAX_GAS_PRICE_WEI };
  }

  return {};
}
