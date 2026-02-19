import 'server-only';

import { Contract, JsonRpcProvider, Wallet, Log, EventLog } from 'ethers';
import borrowerCredentialAbi from '../contracts/BorrowerCredential.abi.json';
import investorCredentialAbi from '../contracts/InvestorCredential.abi.json';
import { getEthersGasOverrides } from '@/lib/contracts/gas-safety';

// Lazy initialization to avoid errors during build time when env vars may not be set
let provider: JsonRpcProvider | null = null;
let issuerSigner: Wallet | null = null;
let borrowerCredentialContract: Contract | null = null;
let investorCredentialContract: Contract | null = null;

function getProvider(): JsonRpcProvider {
  if (!provider) {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
    if (!rpcUrl) {
      throw new Error('NEXT_PUBLIC_RPC_URL environment variable is not set');
    }
    provider = new JsonRpcProvider(rpcUrl);
  }
  return provider;
}

function getSigner(): Wallet {
  if (!issuerSigner) {
    const privateKey = process.env.CREDENTIAL_ISSUER_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('CREDENTIAL_ISSUER_PRIVATE_KEY environment variable is not set');
    }
    issuerSigner = new Wallet(privateKey, getProvider());
  }
  return issuerSigner;
}

function getCredentialContract(): Contract {
  if (!borrowerCredentialContract) {
    const contractAddress = process.env.BORROWER_CREDENTIAL_ADDRESS;
    if (!contractAddress) {
      throw new Error('BORROWER_CREDENTIAL_ADDRESS environment variable is not set');
    }
    borrowerCredentialContract = new Contract(
      contractAddress,
      borrowerCredentialAbi.abi,
      getSigner()
    );
  }
  return borrowerCredentialContract;
}

function getInvestorCredentialContract(): Contract {
  if (!investorCredentialContract) {
    const contractAddress = process.env.INVESTOR_CREDENTIAL_ADDRESS;
    if (!contractAddress) {
      throw new Error('INVESTOR_CREDENTIAL_ADDRESS environment variable is not set');
    }
    investorCredentialContract = new Contract(
      contractAddress,
      investorCredentialAbi,
      getSigner()
    );
  }
  return investorCredentialContract;
}

/**
 * KYC Levels:
 * 1 = Basic KYC (Plaid Identity Verification)
 * 2 = Enhanced KYC (Additional verification)
 */
export enum KYCLevel {
  BASIC = 1,
  ENHANCED = 2,
}

/**
 * Result from minting a borrower credential
 */
export interface MintCredentialResult {
  success: boolean;
  tokenId?: string;
  txHash?: string;
  error?: string;
}

/**
 * Mints a BorrowerCredential NFT for a user who has completed KYC
 *
 * @param to - The address to receive the credential (smart account address)
 * @param kycLevel - The KYC verification level (1 = Basic, 2 = Enhanced)
 * @param validityPeriod - How long the credential is valid in seconds (default: 1 year)
 * @param plaidVerificationId - The Plaid identity verification ID
 * @returns Result containing tokenId and transaction hash
 */
export async function mintBorrowerCredential({
  to,
  kycLevel = KYCLevel.BASIC,
  validityPeriod = 365 * 24 * 60 * 60, // 1 year in seconds
  plaidVerificationId,
}: {
  to: string;
  kycLevel?: KYCLevel;
  validityPeriod?: number;
  plaidVerificationId: string;
}): Promise<MintCredentialResult> {
  try {
    const contract = getCredentialContract();

    // Check if address already has a credential
    const existingTokenId = await contract.addressToTokenId(to);
    if (existingTokenId > 0) {
      // Check if existing credential is still valid
      const isValid = await contract.isCredentialValid(existingTokenId);
      if (isValid) {
        return {
          success: true,
          tokenId: existingTokenId.toString(),
          error: 'Credential already exists and is valid',
        };
      }
      // If credential exists but is expired/revoked, we can't mint a new one
      // The contract enforces one credential per address
      return {
        success: false,
        error: 'Address has an existing credential that needs renewal or is permanently revoked',
      };
    }

    // Issue the credential
    const gasOverrides = await getEthersGasOverrides(getProvider());
    const tx = await contract.issueCredential(
      to,
      kycLevel,
      validityPeriod,
      plaidVerificationId,
      gasOverrides
    );

    console.log(`[mintBorrowerCredential] Transaction submitted: ${tx.hash}`);

    const receipt = await tx.wait();

    if (receipt.status === 0) {
      throw new Error('Transaction failed');
    }

    // Extract tokenId from CredentialIssued event
    const credentialIssuedEvent = receipt.logs.find((log: Log | EventLog) => {
      if ('fragment' in log && log.fragment) {
        return log.fragment.name === 'CredentialIssued';
      }
      return false;
    }) as EventLog | undefined;

    if (!credentialIssuedEvent || !('args' in credentialIssuedEvent)) {
      throw new Error('CredentialIssued event not found in transaction logs');
    }

    const tokenId = credentialIssuedEvent.args.tokenId.toString();

    console.log(`[mintBorrowerCredential] Credential minted: tokenId=${tokenId}, txHash=${receipt.hash}`);

    return {
      success: true,
      tokenId,
      txHash: receipt.hash,
    };
  } catch (error) {
    console.error('[mintBorrowerCredential] Error minting credential:', error);

    // Handle specific contract errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('CredentialAlreadyExists')) {
      return {
        success: false,
        error: 'Credential already exists for this address',
      };
    }

    if (errorMessage.includes('InvalidKYCLevel')) {
      return {
        success: false,
        error: 'Invalid KYC level specified',
      };
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Checks if an address has a valid borrower credential
 *
 * @param address - The address to check
 * @returns True if the address has a valid credential
 */
export async function hasValidBorrowerCredential(address: string): Promise<boolean> {
  try {
    const contract = getCredentialContract();
    return await contract.hasValidCredential(address);
  } catch (error) {
    console.error('[hasValidBorrowerCredential] Error checking credential:', error);
    return false;
  }
}

/**
 * Gets the KYC level of an address
 *
 * @param address - The address to check
 * @returns The KYC level (0 if no valid credential)
 */
export async function getKYCLevel(address: string): Promise<number> {
  try {
    const contract = getCredentialContract();
    const level = await contract.getKYCLevel(address);
    return Number(level);
  } catch (error) {
    console.error('[getKYCLevel] Error getting KYC level:', error);
    return 0;
  }
}

/**
 * Gets the token ID for an address
 *
 * @param address - The address to check
 * @returns The token ID (0 if no credential)
 */
export async function getTokenId(address: string): Promise<string> {
  try {
    const contract = getCredentialContract();
    const tokenId = await contract.addressToTokenId(address);
    return tokenId.toString();
  } catch (error) {
    console.error('[getTokenId] Error getting token ID:', error);
    return '0';
  }
}

// ============================================
// INVESTOR CREDENTIAL FUNCTIONS
// ============================================

/**
 * Accreditation Levels for Investors:
 * 0 = None (retail investor)
 * 1 = Accredited investor ($200k income or $1M net worth)
 * 2 = Qualified purchaser ($5M+ in investments)
 * 3 = Institutional investor
 */
export enum AccreditationLevel {
  RETAIL = 0,
  ACCREDITED = 1,
  QUALIFIED = 2,
  INSTITUTIONAL = 3,
}

/**
 * Result from minting an investor credential
 */
export interface MintInvestorCredentialResult {
  success: boolean;
  tokenId?: string;
  txHash?: string;
  error?: string;
}

/**
 * Mints an InvestorCredential NFT for a user who has completed verification
 *
 * @param to - The address to receive the credential (wallet address)
 * @param accreditationLevel - The accreditation level (0-3)
 * @param validityPeriod - How long the credential is valid in seconds (default: 1 year)
 * @param investmentLimit - Maximum investment allowed in USD cents (0 = unlimited)
 * @param plaidVerificationId - The Plaid identity verification ID (or other verification ID)
 * @returns Result containing tokenId and transaction hash
 */
export async function mintInvestorCredential({
  to,
  accreditationLevel = AccreditationLevel.RETAIL,
  validityPeriod = 365 * 24 * 60 * 60, // 1 year in seconds
  investmentLimit = 0, // 0 = unlimited
  plaidVerificationId,
}: {
  to: string;
  accreditationLevel?: AccreditationLevel;
  validityPeriod?: number;
  investmentLimit?: number;
  plaidVerificationId: string;
}): Promise<MintInvestorCredentialResult> {
  try {
    const contract = getInvestorCredentialContract();

    // Check if address already has a credential
    const existingTokenId = await contract.addressToTokenId(to);
    if (existingTokenId > 0) {
      // Check if existing credential is still valid
      const isValid = await contract.isCredentialValid(existingTokenId);
      if (isValid) {
        return {
          success: true,
          tokenId: existingTokenId.toString(),
          error: 'Investor credential already exists and is valid',
        };
      }
      // If credential exists but is expired/revoked, we can't mint a new one
      return {
        success: false,
        error: 'Address has an existing credential that needs renewal or is permanently revoked',
      };
    }

    // Issue the credential
    // Function signature: issueCredential(address to, uint256 accreditationLevel, uint256 validityPeriod, uint256 investmentLimit, string plaidVerificationId)
    const gasOverrides = await getEthersGasOverrides(getProvider());
    const tx = await contract.issueCredential(
      to,
      accreditationLevel,
      validityPeriod,
      investmentLimit,
      plaidVerificationId,
      gasOverrides
    );

    console.log(`[mintInvestorCredential] Transaction submitted: ${tx.hash}`);

    const receipt = await tx.wait();

    if (receipt.status === 0) {
      throw new Error('Transaction failed');
    }

    // Extract tokenId from CredentialIssued event
    const credentialIssuedEvent = receipt.logs.find((log: Log | EventLog) => {
      if ('fragment' in log && log.fragment) {
        return log.fragment.name === 'CredentialIssued';
      }
      return false;
    }) as EventLog | undefined;

    if (!credentialIssuedEvent || !('args' in credentialIssuedEvent)) {
      throw new Error('CredentialIssued event not found in transaction logs');
    }

    const tokenId = credentialIssuedEvent.args.tokenId.toString();

    console.log(`[mintInvestorCredential] Credential minted: tokenId=${tokenId}, txHash=${receipt.hash}`);

    return {
      success: true,
      tokenId,
      txHash: receipt.hash,
    };
  } catch (error) {
    console.error('[mintInvestorCredential] Error minting credential:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('CredentialAlreadyExists')) {
      return {
        success: false,
        error: 'Investor credential already exists for this address',
      };
    }

    if (errorMessage.includes('InvalidAccreditationLevel')) {
      return {
        success: false,
        error: 'Invalid accreditation level specified',
      };
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Checks if an address has a valid investor credential
 *
 * @param address - The address to check
 * @returns True if the address has a valid credential
 */
export async function hasValidInvestorCredential(address: string): Promise<boolean> {
  try {
    const contract = getInvestorCredentialContract();
    return await contract.hasValidCredential(address);
  } catch (error) {
    console.error('[hasValidInvestorCredential] Error checking credential:', error);
    return false;
  }
}

/**
 * Gets the accreditation level of an address
 *
 * @param address - The address to check
 * @returns The accreditation level (0 if no valid credential)
 */
export async function getAccreditationLevel(address: string): Promise<number> {
  try {
    const contract = getInvestorCredentialContract();
    const level = await contract.getAccreditationLevel(address);
    return Number(level);
  } catch (error) {
    console.error('[getAccreditationLevel] Error getting accreditation level:', error);
    return 0;
  }
}

/**
 * Gets the investor token ID for an address
 *
 * @param address - The address to check
 * @returns The token ID (0 if no credential)
 */
export async function getInvestorTokenId(address: string): Promise<string> {
  try {
    const contract = getInvestorCredentialContract();
    const tokenId = await contract.addressToTokenId(address);
    return tokenId.toString();
  } catch (error) {
    console.error('[getInvestorTokenId] Error getting token ID:', error);
    return '0';
  }
}

/**
 * Checks if an address is an accredited investor (level >= 1)
 *
 * @param address - The address to check
 * @returns True if the address is accredited
 */
export async function isAccreditedInvestor(address: string): Promise<boolean> {
  try {
    const contract = getInvestorCredentialContract();
    return await contract.isAccredited(address);
  } catch (error) {
    console.error('[isAccreditedInvestor] Error checking accreditation:', error);
    return false;
  }
}
