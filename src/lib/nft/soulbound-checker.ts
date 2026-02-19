import { createPublicClient, http, Address } from 'viem';
import { arbitrum } from 'viem/chains';

/**
 * Soulbound NFT Credential System
 * ================================
 *
 * IMPORTANT: Address Usage for NFT Credentials
 * --------------------------------------------
 * All NFT credentials (Borrower SBT, Investor SBT) should be minted to and
 * checked against the user's **Smart Account address** (Locale ID), NOT their
 * EOA (controlling wallet) address.
 *
 * Why Smart Account?
 * - The Smart Account address is the user's permanent Locale identity
 * - It remains constant even if the user changes their controlling wallet
 * - Credentials stay with the user's Locale ID across all Locale dApps
 * - Enables cross-dApp identity portability (staking, lending, etc.)
 *
 * Address Types:
 * - Smart Account Address: The user's Locale ID (use for NFT minting/checking)
 * - EOA Address: The controlling wallet (MetaMask, etc.) - user's funds live here
 *
 * When implementing NFT minting, always use the smart account address
 * from useSmartAccountAddress() hook or user.address from useUser().
 */

/**
 * ERC-5192 (Soulbound Token) Minimal ABI
 *
 * ERC-5192 extends ERC-721 with locked() function to indicate non-transferability
 */
const SOULBOUND_NFT_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'locked',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Create a Viem public client for reading blockchain data
 */
const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL),
});

/**
 * Check if testing mode is enabled (bypasses all SBT checks)
 * SECURITY: Testing mode is blocked in production to prevent accidental deployment
 */
export function isTestingMode(): boolean {
  if (process.env.DISABLE_SBT_CHECKS === 'true' && process.env.NODE_ENV === 'production') {
    console.warn(
      '[SECURITY] DISABLE_SBT_CHECKS=true is ignored in production. Remove this env var.'
    );
    return false;
  }
  return process.env.DISABLE_SBT_CHECKS === 'true' && process.env.NODE_ENV !== 'production';
}

/**
 * Check if an address owns a specific Soulbound NFT
 *
 * @param address - The Smart Account address (Locale ID) to check. Always pass
 *                  the smart account address, not the EOA, to ensure credentials
 *                  are portable across wallet changes.
 * @param contractAddress - The Soulbound NFT contract address
 * @returns true if the address owns at least one token, false otherwise
 */
export async function checkSoulboundNFTOwnership(
  address: string,
  contractAddress: string
): Promise<boolean> {
  try {
    // Check if testing mode is enabled
    if (isTestingMode()) {
      console.warn(
        `🚧 TESTING MODE: SBT check bypassed for ${address} on contract ${contractAddress}`
      );
      return true;
    }

    // Validate addresses
    if (!address || !contractAddress) {
      console.error('Invalid address or contract address provided');
      return false;
    }

    // Read balance from contract
    const balance = await publicClient.readContract({
      address: contractAddress as Address,
      abi: SOULBOUND_NFT_ABI,
      functionName: 'balanceOf',
      args: [address as Address],
    });

    // User must own at least 1 token
    return balance > 0n;
  } catch (error) {
    console.error('Error checking Soulbound NFT ownership:', error);
    return false;
  }
}

/**
 * Check if address owns Borrower Soulbound NFT
 *
 * Borrower SBTs are issued after passing KYC/AML verification through Plaid.
 * This credential allows users to apply for loans on the platform.
 *
 * @param address - The Smart Account address (Locale ID) to check.
 *                  Use user.address from useUser() or smartAccountAddress
 *                  from useSmartAccountAddress().
 * @returns true if address owns Borrower SBT
 */
export async function checkBorrowerSBT(address: string): Promise<boolean> {
  const contractAddress = process.env.NEXT_PUBLIC_BORROWER_NFT_ADDRESS;

  if (!contractAddress) {
    console.error(
      'NEXT_PUBLIC_BORROWER_NFT_ADDRESS not set in environment variables'
    );
    // In production, return false. In testing mode, return true.
    return isTestingMode();
  }

  return await checkSoulboundNFTOwnership(address, contractAddress);
}

/**
 * Check if address owns Investor Soulbound NFT
 *
 * Investor SBTs are issued after passing KYC/AML verification through Plaid.
 * This credential allows users to stake funds into lending pools.
 *
 * @param address - The Smart Account address (Locale ID) to check.
 *                  Use user.address from useUser() or smartAccountAddress
 *                  from useSmartAccountAddress().
 * @returns true if address owns Investor SBT
 */
export async function checkInvestorSBT(address: string): Promise<boolean> {
  const contractAddress = process.env.NEXT_PUBLIC_INVESTOR_NFT_ADDRESS;

  if (!contractAddress) {
    console.error(
      'NEXT_PUBLIC_INVESTOR_NFT_ADDRESS not set in environment variables'
    );
    // In production, return false. In testing mode, return true.
    return isTestingMode();
  }

  return await checkSoulboundNFTOwnership(address, contractAddress);
}

/**
 * Check if address owns BOTH Borrower and Investor SBTs
 *
 * @param address - The wallet address to check
 * @returns Object with borrower and investor SBT status
 */
export async function checkAllSBTs(address: string): Promise<{
  hasBorrowerSBT: boolean;
  hasInvestorSBT: boolean;
}> {
  const [hasBorrowerSBT, hasInvestorSBT] = await Promise.all([
    checkBorrowerSBT(address),
    checkInvestorSBT(address),
  ]);

  return {
    hasBorrowerSBT,
    hasInvestorSBT,
  };
}

/**
 * Get user's SBT token IDs from the Account table
 *
 * This is useful for displaying NFT information without making blockchain calls.
 * Token IDs are stored in the database when NFTs are minted.
 *
 * @param address - The wallet address
 * @returns Object with borrowerNFTTokenId and investorNFTTokenId
 */
export async function getSBTTokenIds(address: string): Promise<{
  borrowerNFTTokenId: string | null;
  investorNFTTokenId: string | null;
}> {
  // This will be implemented once we have Prisma queries set up
  // For now, return null values
  return {
    borrowerNFTTokenId: null,
    investorNFTTokenId: null,
  };
}
