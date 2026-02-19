'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallets, usePrivy } from '@privy-io/react-auth';
import { type Address, createPublicClient, createWalletClient, custom, http, encodeFunctionData, type Hex } from 'viem';
import { arbitrum, arbitrumSepolia } from 'viem/chains';
import { loanPoolAbi, LOAN_POOL_ADDRESS, hashLoanId } from '@/lib/contracts/loanPool';
import { erc20Abi } from '@/lib/contracts/stakingPool';

const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID ? parseInt(process.env.NEXT_PUBLIC_CHAIN_ID, 10) : undefined;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;

function getChain() {
  switch (CHAIN_ID) {
    case 421614: return arbitrumSepolia;
    case 42161: return arbitrum;
    default: throw new Error(`Unsupported NEXT_PUBLIC_CHAIN_ID: ${CHAIN_ID}. Must be 421614 (Arbitrum Sepolia) or 42161 (Arbitrum One).`);
  }
}

// Create a public client for read operations
const publicClient = createPublicClient({
  chain: getChain(),
  transport: http(RPC_URL),
});

const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

/**
 * Find the correct wallet from useWallets() that matches the user's linked wallet.
 * useWallets() can return multiple wallets (embedded + external); we need the one
 * that matches the address stored in the database (which is the linked wallet).
 */
function useLinkedWallet() {
  const { user } = usePrivy();
  const { wallets } = useWallets();

  // Find the linked wallet address from user's linked accounts (same logic as privy-wallet-button)
  const linkedWallets = user?.linkedAccounts
    ?.filter(a => a.type === 'wallet' && 'address' in a)
    .map(a => a as { type: 'wallet'; address: string; walletClient?: string }) || [];

  // Prefer embedded wallet (privy) over external wallets
  const embeddedWallet = linkedWallets.find(w => w.walletClient === 'privy');
  const linkedAddress = embeddedWallet?.address || linkedWallets[0]?.address;

  // Find the matching wallet object (need the object for getEthereumProvider)
  const wallet = linkedAddress
    ? wallets.find(w => w.address.toLowerCase() === linkedAddress.toLowerCase()) || wallets[0]
    : wallets[0];

  return { wallet, address: wallet?.address as Address | undefined };
}

/**
 * Helper: ensure the loan pool has sufficient ERC20 allowance.
 * Reads the token address from the pool contract, checks allowance,
 * and sends an approve tx if needed.
 */
async function ensureTokenApproval(
  walletClient: ReturnType<typeof createWalletClient>,
  ownerAddress: Address,
) {
  // Read token address from the loan pool contract
  const tokenAddress = await publicClient.readContract({
    address: LOAN_POOL_ADDRESS,
    abi: loanPoolAbi,
    functionName: 'token',
  }) as Address;

  // Check current allowance
  const currentAllowance = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [ownerAddress, LOAN_POOL_ADDRESS],
  }) as bigint;

  // If allowance is already large enough, skip approval
  // We approve max uint256 so this only needs to happen once
  if (currentAllowance > BigInt(0)) {
    console.log('[ensureTokenApproval] Sufficient allowance:', currentAllowance.toString());
    return;
  }

  console.log('[ensureTokenApproval] Approving loan pool to spend tokens...');

  const approveHash = await walletClient.writeContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [LOAN_POOL_ADDRESS, MAX_UINT256],
    account: ownerAddress,
    chain: getChain(),
  });

  // Wait for approval confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
  if (receipt.status !== 'success') {
    throw new Error('Token approval transaction failed');
  }

  console.log('[ensureTokenApproval] Approval confirmed:', approveHash);
}

interface LoanDetails {
  amount: bigint | undefined;
  isActive: boolean | undefined;
  borrower: Address | undefined;
  interestRate: bigint | undefined;
  repaymentAmount: bigint | undefined;
  remainingMonths: bigint | undefined;
}

/**
 * Hook to read loan details from the contract
 */
export function useLoanDetails(loanId: string | undefined) {
  const hashedId = loanId ? hashLoanId(loanId) : undefined;
  const [details, setDetails] = useState<LoanDetails>({
    amount: undefined,
    isActive: undefined,
    borrower: undefined,
    interestRate: undefined,
    repaymentAmount: undefined,
    remainingMonths: undefined,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!hashedId) return;

    setIsLoading(true);

    try {
      const [amount, isActive, borrower, interestRate, repaymentAmount, remainingMonths] = await Promise.all([
        publicClient.readContract({
          address: LOAN_POOL_ADDRESS,
          abi: loanPoolAbi,
          functionName: 'loanIdToAmount',
          args: [hashedId],
        }),
        publicClient.readContract({
          address: LOAN_POOL_ADDRESS,
          abi: loanPoolAbi,
          functionName: 'loanIdToActive',
          args: [hashedId],
        }),
        publicClient.readContract({
          address: LOAN_POOL_ADDRESS,
          abi: loanPoolAbi,
          functionName: 'loanIdToBorrower',
          args: [hashedId],
        }),
        publicClient.readContract({
          address: LOAN_POOL_ADDRESS,
          abi: loanPoolAbi,
          functionName: 'loanIdToInterestRate',
          args: [hashedId],
        }),
        publicClient.readContract({
          address: LOAN_POOL_ADDRESS,
          abi: loanPoolAbi,
          functionName: 'loanIdToRepaymentAmount',
          args: [hashedId],
        }),
        publicClient.readContract({
          address: LOAN_POOL_ADDRESS,
          abi: loanPoolAbi,
          functionName: 'loanIdToRepaymentRemainingMonths',
          args: [hashedId],
        }),
      ]);

      setDetails({
        amount: amount as bigint,
        isActive: isActive as boolean,
        borrower: borrower as Address,
        interestRate: interestRate as bigint,
        repaymentAmount: repaymentAmount as bigint,
        remainingMonths: remainingMonths as bigint,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch loan details'));
    } finally {
      setIsLoading(false);
    }
  }, [hashedId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    ...details,
    isLoading,
    error,
    hashedLoanId: hashedId,
    refetch,
  };
}

/**
 * Hook to get the next repayment details for a loan
 */
export function useNextRepayment(loanId: string | undefined) {
  const hashedId = loanId ? hashLoanId(loanId) : undefined;
  const [remainingTotal, setRemainingTotal] = useState<bigint | undefined>(undefined);
  const [interestPayment, setInterestPayment] = useState<bigint | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!hashedId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await publicClient.readContract({
        address: LOAN_POOL_ADDRESS,
        abi: loanPoolAbi,
        functionName: 'getNextRepayment',
        args: [hashedId],
      });

      const [remaining, interest] = data as [bigint, bigint];
      setRemainingTotal(remaining);
      setInterestPayment(interest);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch repayment'));
    } finally {
      setIsLoading(false);
    }
  }, [hashedId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    remainingTotal,
    interestPayment,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to get pool statistics
 */
export function usePoolStats() {
  const [totalLentAmount, setTotalLentAmount] = useState<bigint | undefined>(undefined);
  const [tokenAddress, setTokenAddress] = useState<Address | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      setIsLoading(true);

      try {
        const [totalLent, token] = await Promise.all([
          publicClient.readContract({
            address: LOAN_POOL_ADDRESS,
            abi: loanPoolAbi,
            functionName: 'totalLentAmount',
          }),
          publicClient.readContract({
            address: LOAN_POOL_ADDRESS,
            abi: loanPoolAbi,
            functionName: 'token',
          }),
        ]);

        setTotalLentAmount(totalLent as bigint);
        setTokenAddress(token as Address);
      } catch {
        // Ignore errors
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  return {
    totalLentAmount,
    tokenAddress,
    isLoading,
  };
}

/**
 * Hook for borrowers to make loan repayments
 * Uses Privy wallet for transaction signing
 */
export function useMakeRepayment() {
  const { wallet, address } = useLinkedWallet();
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);

  const makeRepayment = useCallback(async (loanId: string) => {
    const hashedId = hashLoanId(loanId);

    if (!wallet) {
      throw new Error('No wallet connected. Please connect your wallet first.');
    }

    setIsConfirmed(false);
    setTxHash(undefined);
    setError(null);
    setIsPending(true);

    const data = encodeFunctionData({
      abi: loanPoolAbi,
      functionName: 'makeRepayment',
      args: [hashedId],
    });

    try {
      // Switch to correct chain
      if (CHAIN_ID) {
        await wallet.switchChain(CHAIN_ID);
      }

      // Get the ethereum provider from the Privy wallet
      const provider = await wallet.getEthereumProvider();

      // Create a wallet client from the provider
      const walletClient = createWalletClient({
        chain: getChain(),
        transport: custom(provider),
      });

      // Ensure the loan pool has ERC20 approval to pull tokens
      await ensureTokenApproval(walletClient, address!);

      // Estimate gas
      const gasEstimate = await publicClient.estimateGas({
        account: address,
        to: LOAN_POOL_ADDRESS,
        data,
      });

      // Send the transaction
      const hash = await walletClient.sendTransaction({
        account: address!,
        to: LOAN_POOL_ADDRESS,
        data,
        gas: gasEstimate + (gasEstimate / 10n), // Add 10% buffer
        chain: getChain(),
      });

      setTxHash(hash);

      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({ hash });
      setIsConfirmed(true);

      return { ids: [hash] };
    } catch (err) {
      console.error('[useMakeRepayment] Failed:', err);
      setError(err instanceof Error ? err : new Error('Repayment failed'));
      throw err;
    } finally {
      setIsPending(false);
    }
  }, [wallet, address]);

  const reset = useCallback(() => {
    setTxHash(undefined);
    setIsConfirmed(false);
    setError(null);
    setIsPending(false);
  }, []);

  return {
    makeRepayment,
    hash: txHash,
    isPending,
    isConfirming: isPending,
    isConfirmed,
    error,
    reset,
  };
}

/**
 * Hook for borrowers to make partial loan repayments
 * Uses the makePartialRepayment contract function with a specified amount
 */
export function useMakePartialRepayment() {
  const { wallet, address } = useLinkedWallet();
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);

  const makePartialRepayment = useCallback(async (loanId: string, amount: bigint) => {
    const hashedId = hashLoanId(loanId);

    if (!wallet) {
      throw new Error('No wallet connected. Please connect your wallet first.');
    }

    setIsConfirmed(false);
    setTxHash(undefined);
    setError(null);
    setIsPending(true);

    const data = encodeFunctionData({
      abi: loanPoolAbi,
      functionName: 'makePartialRepayment',
      args: [hashedId, amount],
    });

    try {
      // Switch to correct chain
      if (CHAIN_ID) {
        await wallet.switchChain(CHAIN_ID);
      }

      const provider = await wallet.getEthereumProvider();

      const walletClient = createWalletClient({
        chain: getChain(),
        transport: custom(provider),
      });

      // Ensure the loan pool has ERC20 approval to pull tokens
      await ensureTokenApproval(walletClient, address!);

      const gasEstimate = await publicClient.estimateGas({
        account: address,
        to: LOAN_POOL_ADDRESS,
        data,
      });

      const hash = await walletClient.sendTransaction({
        account: address!,
        to: LOAN_POOL_ADDRESS,
        data,
        gas: gasEstimate + (gasEstimate / 10n),
        chain: getChain(),
      });

      setTxHash(hash);

      await publicClient.waitForTransactionReceipt({ hash });
      setIsConfirmed(true);

      return { ids: [hash] };
    } catch (err) {
      console.error('[useMakePartialRepayment] Failed:', err);
      setError(err instanceof Error ? err : new Error('Partial repayment failed'));
      throw err;
    } finally {
      setIsPending(false);
    }
  }, [wallet, address]);

  const reset = useCallback(() => {
    setTxHash(undefined);
    setIsConfirmed(false);
    setError(null);
    setIsPending(false);
  }, []);

  return {
    makePartialRepayment,
    hash: txHash,
    isPending,
    isConfirming: isPending,
    isConfirmed,
    error,
    reset,
  };
}

/**
 * Hook to check if a loan exists on-chain
 */
export function useLoanExists(loanId: string | undefined) {
  const { borrower, isLoading } = useLoanDetails(loanId);

  // If borrower is zero address, loan doesn't exist
  const exists =
    borrower !== undefined &&
    borrower !== '0x0000000000000000000000000000000000000000';

  return { exists, isLoading };
}
