'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { type Address, createPublicClient, createWalletClient, custom, http, type Hex } from 'viem';
import { arbitrum, arbitrumSepolia } from 'viem/chains';
import {
  stakingPoolAbi,
  erc20Abi,
  STAKING_POOL_ADDRESS,
  hashPoolId,
  type PoolData,
  type UserStakeData,
} from '@/lib/contracts/stakingPool';

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

// Debug logging for contract configuration
if (typeof window !== 'undefined') {
  console.log('[useStakingPool] Contract config:', {
    stakingPoolAddress: STAKING_POOL_ADDRESS,
    rpcUrl: RPC_URL,
    chainId: CHAIN_ID,
  });
}

/**
 * Hook to get pool details from the contract
 */
export function usePoolDetails(poolId: string | undefined) {
  const [pool, setPool] = useState<PoolData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const hashedId = poolId ? hashPoolId(poolId) : undefined;

  const refetch = useCallback(async () => {
    if (!hashedId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await publicClient.readContract({
        address: STAKING_POOL_ADDRESS,
        abi: stakingPoolAbi,
        functionName: 'getPool',
        args: [hashedId],
      });

      setPool({
        name: data[0],
        minimumStake: data[1],
        totalStaked: data[2],
        totalShares: data[3],
        feeRate: data[4],
        poolCooldownPeriod: data[5],
        maturityDate: data[6],
        eligibilityRegistry: data[7],
        active: data[8],
        cooldownWaived: data[9],
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch pool'));
    } finally {
      setIsLoading(false);
    }
  }, [hashedId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    pool,
    isLoading,
    error,
    refetch,
    hashedPoolId: hashedId,
  };
}

/**
 * Hook to get user's stake in a specific pool
 */
export function useUserStake(poolId: string | undefined) {
  const { address: walletAddress } = useWalletAuth();
  const address = walletAddress as Address | undefined;
  const hashedId = poolId ? hashPoolId(poolId) : undefined;

  const [stake, setStake] = useState<UserStakeData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!hashedId || !address) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await publicClient.readContract({
        address: STAKING_POOL_ADDRESS,
        abi: stakingPoolAbi,
        functionName: 'getUserStake',
        args: [hashedId, address],
      });

      setStake({
        principal: data[0],
        amount: data[1],
        shares: data[2],
        stakedAt: data[3],
        pendingUnstake: data[4],
        canWithdrawAt: data[5],
        claimedYield: data[6],
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch stake'));
    } finally {
      setIsLoading(false);
    }
  }, [hashedId, address]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    stake,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to get the current value of user's stake (including any yield)
 */
export function useStakeValue(poolId: string | undefined) {
  const { address: walletAddress } = useWalletAuth();
  const address = walletAddress as Address | undefined;
  const hashedId = poolId ? hashPoolId(poolId) : undefined;

  const [value, setValue] = useState<bigint | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!hashedId || !address) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await publicClient.readContract({
        address: STAKING_POOL_ADDRESS,
        abi: stakingPoolAbi,
        functionName: 'getStakeValue',
        args: [hashedId, address],
      });

      setValue(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch stake value'));
    } finally {
      setIsLoading(false);
    }
  }, [hashedId, address]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    value,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to get staking token address and allowance
 */
export function useStakingToken() {
  const { address: walletAddress } = useWalletAuth();
  const address = walletAddress as Address | undefined;

  const [tokenAddress, setTokenAddress] = useState<Address | undefined>(undefined);
  const [allowance, setAllowance] = useState<bigint | undefined>(undefined);
  const [balance, setBalance] = useState<bigint | undefined>(undefined);

  const refetchAllowance = useCallback(async (): Promise<bigint | undefined> => {
    if (!address || !tokenAddress) return undefined;

    try {
      const data = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, STAKING_POOL_ADDRESS],
      });
      setAllowance(data);
      return data;
    } catch {
      // Ignore errors
      return undefined;
    }
  }, [address, tokenAddress]);

  const refetchBalance = useCallback(async () => {
    if (!address || !tokenAddress) return;

    try {
      const data = await publicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      });
      setBalance(data);
    } catch (err) {
      console.error('[useStakingToken] Balance fetch error:', err);
    }
  }, [address, tokenAddress]);

  useEffect(() => {
    async function fetchTokenAddress() {
      if (!STAKING_POOL_ADDRESS) {
        console.error('[useStakingToken] STAKING_POOL_ADDRESS is not configured');
        return;
      }
      try {
        console.log('[useStakingToken] Fetching staking token from:', STAKING_POOL_ADDRESS);
        const data = await publicClient.readContract({
          address: STAKING_POOL_ADDRESS,
          abi: stakingPoolAbi,
          functionName: 'stakingToken',
        });
        console.log('[useStakingToken] Token address fetched:', data);
        setTokenAddress(data as Address);
      } catch (err) {
        console.error('[useStakingToken] Failed to fetch token address:', err);
      }
    }
    fetchTokenAddress();
  }, []);

  useEffect(() => {
    if (tokenAddress && address) {
      refetchAllowance();
      refetchBalance();
    }
  }, [tokenAddress, address, refetchAllowance, refetchBalance]);

  return {
    tokenAddress,
    allowance,
    balance,
    refetchAllowance,
    refetchBalance,
  };
}

/**
 * Hook to approve staking token spending
 * Uses Privy wallet for transaction signing
 */
export function useApproveToken() {
  const { tokenAddress, refetchAllowance } = useStakingToken();
  const { wallet } = useWalletAuth();
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);

  const approve = useCallback(async (amount: bigint) => {
    if (!tokenAddress) {
      console.error('[useApproveToken] Token address not available');
      throw new Error('Token address not loaded. Please wait and try again.');
    }

    if (!STAKING_POOL_ADDRESS) {
      console.error('[useApproveToken] Staking pool address not configured');
      throw new Error('Staking pool address not configured.');
    }

    if (!wallet) {
      throw new Error('No wallet connected. Please connect your wallet first.');
    }

    console.log('[useApproveToken] Approving via Privy wallet:', {
      tokenAddress,
      spender: STAKING_POOL_ADDRESS,
      amount: amount.toString(),
    });

    setIsConfirmed(false);
    setTxHash(undefined);
    setError(null);
    setIsPending(true);

    try {
      // Switch wallet to the correct chain before transacting
      if (CHAIN_ID) {
        await wallet.switchChain(CHAIN_ID);
      }

      // Get the ethereum provider from the wallet
      const provider = await wallet.getEthereumProvider();

      // Create a wallet client from the provider
      const walletClient = createWalletClient({
        chain: getChain(),
        transport: custom(provider),
      });

      const [account] = await walletClient.getAddresses();

      // Send the approval transaction
      const hash = await walletClient.writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [STAKING_POOL_ADDRESS, amount],
        account,
        chain: getChain(),
      });

      console.log('[useApproveToken] Approval result:', hash);

      setTxHash(hash);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setIsConfirmed(true);
        await refetchAllowance();
      } else {
        throw new Error('Transaction failed');
      }

      return { hash };
    } catch (err) {
      console.error('[useApproveToken] Approval failed:', err);
      setError(err instanceof Error ? err : new Error('Approval failed'));
      throw err;
    } finally {
      setIsPending(false);
    }
  }, [tokenAddress, wallet, refetchAllowance]);

  const reset = useCallback(() => {
    setTxHash(undefined);
    setIsConfirmed(false);
    setError(null);
    setIsPending(false);
  }, []);

  return {
    approve,
    hash: txHash,
    isPending,
    isConfirming: isPending,
    isConfirmed,
    error,
    reset,
  };
}

/**
 * Hook to stake tokens into a pool
 * Uses Privy wallet for transaction signing
 */
export function useStake() {
  const { wallet } = useWalletAuth();
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);

  const stake = useCallback(async (poolId: string, amount: bigint) => {
    if (!STAKING_POOL_ADDRESS) {
      console.error('[useStake] Staking pool address not configured');
      throw new Error('Staking pool address not configured.');
    }

    if (!wallet) {
      throw new Error('No wallet connected. Please connect your wallet first.');
    }

    const hashedId = hashPoolId(poolId);

    console.log('[useStake] Staking via Privy wallet:', {
      poolId,
      hashedId,
      amount: amount.toString(),
      stakingPoolAddress: STAKING_POOL_ADDRESS,
    });

    setIsConfirmed(false);
    setTxHash(undefined);
    setError(null);
    setIsPending(true);

    try {
      // Switch wallet to the correct chain before transacting
      if (CHAIN_ID) {
        await wallet.switchChain(CHAIN_ID);
      }

      // Get the ethereum provider from the wallet
      const provider = await wallet.getEthereumProvider();

      // Create a wallet client from the provider
      const walletClient = createWalletClient({
        chain: getChain(),
        transport: custom(provider),
      });

      const [account] = await walletClient.getAddresses();

      // Send the stake transaction
      const hash = await walletClient.writeContract({
        address: STAKING_POOL_ADDRESS,
        abi: stakingPoolAbi,
        functionName: 'stake',
        args: [hashedId, amount],
        account,
        chain: getChain(),
      });

      console.log('[useStake] Stake result:', hash);

      setTxHash(hash);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setIsConfirmed(true);
      } else {
        throw new Error('Transaction failed');
      }

      return { hash };
    } catch (err) {
      console.error('[useStake] Stake failed:', err);
      setError(err instanceof Error ? err : new Error('Stake failed'));
      throw err;
    } finally {
      setIsPending(false);
    }
  }, [wallet]);

  const reset = useCallback(() => {
    setTxHash(undefined);
    setIsConfirmed(false);
    setError(null);
    setIsPending(false);
  }, []);

  return {
    stake,
    hash: txHash,
    isPending,
    isConfirming: isPending,
    isConfirmed,
    error,
    reset,
  };
}

/**
 * Hook to request unstaking (starts cooldown period)
 * Uses Privy wallet for transaction signing
 */
export function useRequestUnstake() {
  const { wallet } = useWalletAuth();
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);

  const requestUnstake = useCallback(async (poolId: string, amount: bigint) => {
    if (!wallet) {
      throw new Error('No wallet connected. Please connect your wallet first.');
    }

    const hashedId = hashPoolId(poolId);

    console.log('[useRequestUnstake] Requesting unstake via Privy wallet:', {
      poolId,
      hashedId,
      amount: amount.toString(),
    });

    setIsConfirmed(false);
    setTxHash(undefined);
    setError(null);
    setIsPending(true);

    try {
      if (CHAIN_ID) {
        await wallet.switchChain(CHAIN_ID);
      }

      const provider = await wallet.getEthereumProvider();

      const walletClient = createWalletClient({
        chain: getChain(),
        transport: custom(provider),
      });

      const [account] = await walletClient.getAddresses();

      const hash = await walletClient.writeContract({
        address: STAKING_POOL_ADDRESS,
        abi: stakingPoolAbi,
        functionName: 'requestUnstake',
        args: [hashedId, amount],
        account,
        chain: getChain(),
      });

      console.log('[useRequestUnstake] Result:', hash);

      setTxHash(hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setIsConfirmed(true);
      } else {
        throw new Error('Transaction failed');
      }

      return { hash };
    } catch (err) {
      console.error('[useRequestUnstake] Failed:', err);
      setError(err instanceof Error ? err : new Error('Request unstake failed'));
      throw err;
    } finally {
      setIsPending(false);
    }
  }, [wallet]);

  const reset = useCallback(() => {
    setTxHash(undefined);
    setIsConfirmed(false);
    setError(null);
    setIsPending(false);
  }, []);

  return {
    requestUnstake,
    hash: txHash,
    isPending,
    isConfirming: isPending,
    isConfirmed,
    error,
    reset,
  };
}

/**
 * Hook to complete unstaking after cooldown period
 * Uses Privy wallet for transaction signing
 */
export function useCompleteUnstake() {
  const { wallet } = useWalletAuth();
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);

  const completeUnstake = useCallback(async (poolId: string) => {
    if (!wallet) {
      throw new Error('No wallet connected. Please connect your wallet first.');
    }

    const hashedId = hashPoolId(poolId);

    console.log('[useCompleteUnstake] Completing unstake via Privy wallet:', {
      poolId,
      hashedId,
    });

    setIsConfirmed(false);
    setTxHash(undefined);
    setError(null);
    setIsPending(true);

    try {
      if (CHAIN_ID) {
        await wallet.switchChain(CHAIN_ID);
      }

      const provider = await wallet.getEthereumProvider();

      const walletClient = createWalletClient({
        chain: getChain(),
        transport: custom(provider),
      });

      const [account] = await walletClient.getAddresses();

      const hash = await walletClient.writeContract({
        address: STAKING_POOL_ADDRESS,
        abi: stakingPoolAbi,
        functionName: 'completeUnstake',
        args: [hashedId],
        account,
        chain: getChain(),
      });

      console.log('[useCompleteUnstake] Result:', hash);

      setTxHash(hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setIsConfirmed(true);
      } else {
        throw new Error('Transaction failed');
      }

      return { hash };
    } catch (err) {
      console.error('[useCompleteUnstake] Failed:', err);
      setError(err instanceof Error ? err : new Error('Complete unstake failed'));
      throw err;
    } finally {
      setIsPending(false);
    }
  }, [wallet]);

  const reset = useCallback(() => {
    setTxHash(undefined);
    setIsConfirmed(false);
    setError(null);
    setIsPending(false);
  }, []);

  return {
    completeUnstake,
    hash: txHash,
    isPending,
    isConfirming: isPending,
    isConfirmed,
    error,
    reset,
  };
}

/**
 * Hook to cancel a pending unstake request
 * Uses Privy wallet for transaction signing
 */
export function useCancelUnstake() {
  const { wallet } = useWalletAuth();
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);

  const cancelUnstake = useCallback(async (poolId: string) => {
    if (!wallet) {
      throw new Error('No wallet connected. Please connect your wallet first.');
    }

    const hashedId = hashPoolId(poolId);

    console.log('[useCancelUnstake] Cancelling unstake via Privy wallet:', {
      poolId,
      hashedId,
    });

    setIsConfirmed(false);
    setTxHash(undefined);
    setError(null);
    setIsPending(true);

    try {
      if (CHAIN_ID) {
        await wallet.switchChain(CHAIN_ID);
      }

      const provider = await wallet.getEthereumProvider();

      const walletClient = createWalletClient({
        chain: getChain(),
        transport: custom(provider),
      });

      const [account] = await walletClient.getAddresses();

      const hash = await walletClient.writeContract({
        address: STAKING_POOL_ADDRESS,
        abi: stakingPoolAbi,
        functionName: 'cancelUnstake',
        args: [hashedId],
        account,
        chain: getChain(),
      });

      console.log('[useCancelUnstake] Result:', hash);

      setTxHash(hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setIsConfirmed(true);
      } else {
        throw new Error('Transaction failed');
      }

      return { hash };
    } catch (err) {
      console.error('[useCancelUnstake] Failed:', err);
      setError(err instanceof Error ? err : new Error('Cancel unstake failed'));
      throw err;
    } finally {
      setIsPending(false);
    }
  }, [wallet]);

  const reset = useCallback(() => {
    setTxHash(undefined);
    setIsConfirmed(false);
    setError(null);
    setIsPending(false);
  }, []);

  return {
    cancelUnstake,
    hash: txHash,
    isPending,
    isConfirming: isPending,
    isConfirmed,
    error,
    reset,
  };
}

/**
 * Hook to get available yield for user in a pool
 */
export function useAvailableYield(poolId: string | undefined) {
  const { address: walletAddress } = useWalletAuth();
  const address = walletAddress as Address | undefined;
  const hashedId = poolId ? hashPoolId(poolId) : undefined;

  const [availableYield, setAvailableYield] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!hashedId || !address) return;

    setIsLoading(true);
    try {
      const data = await publicClient.readContract({
        address: STAKING_POOL_ADDRESS,
        abi: stakingPoolAbi,
        functionName: 'getAvailableYield',
        args: [hashedId, address],
      });
      setAvailableYield(data);
    } catch {
      setAvailableYield(0n);
    } finally {
      setIsLoading(false);
    }
  }, [hashedId, address]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { availableYield, isLoading, refetch };
}

/**
 * Hook to claim yield from a pool
 */
export function useClaimYield() {
  const { wallet } = useWalletAuth();
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);

  const claimYield = useCallback(async (poolId: string) => {
    if (!wallet) {
      throw new Error('No wallet connected. Please connect your wallet first.');
    }

    const hashedId = hashPoolId(poolId);

    setIsConfirmed(false);
    setTxHash(undefined);
    setError(null);
    setIsPending(true);

    try {
      if (CHAIN_ID) {
        await wallet.switchChain(CHAIN_ID);
      }

      const provider = await wallet.getEthereumProvider();

      const walletClient = createWalletClient({
        chain: getChain(),
        transport: custom(provider),
      });

      const [account] = await walletClient.getAddresses();

      const hash = await walletClient.writeContract({
        address: STAKING_POOL_ADDRESS,
        abi: stakingPoolAbi,
        functionName: 'claimYield',
        args: [hashedId],
        account,
        chain: getChain(),
      });

      setTxHash(hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setIsConfirmed(true);
      } else {
        throw new Error('Transaction failed');
      }

      return { hash };
    } catch (err) {
      console.error('[useClaimYield] Failed:', err);
      setError(err instanceof Error ? err : new Error('Claim yield failed'));
      throw err;
    } finally {
      setIsPending(false);
    }
  }, [wallet]);

  const reset = useCallback(() => {
    setTxHash(undefined);
    setIsConfirmed(false);
    setError(null);
    setIsPending(false);
  }, []);

  return {
    claimYield,
    hash: txHash,
    isPending,
    isConfirmed,
    error,
    reset,
  };
}

/**
 * Hook to get cooldown period
 */
export function useCooldownPeriod() {
  const [cooldownPeriod, setCooldownPeriod] = useState<bigint | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchCooldownPeriod() {
      setIsLoading(true);
      try {
        const data = await publicClient.readContract({
          address: STAKING_POOL_ADDRESS,
          abi: stakingPoolAbi,
          functionName: 'cooldownPeriod',
        });
        setCooldownPeriod(data);
      } catch {
        // Ignore errors
      } finally {
        setIsLoading(false);
      }
    }
    fetchCooldownPeriod();
  }, []);

  return {
    cooldownPeriod,
    isLoading,
  };
}

/**
 * Hook to get all pool IDs
 */
export function useAllPoolIds() {
  const [poolIds, setPoolIds] = useState<`0x${string}`[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await publicClient.readContract({
        address: STAKING_POOL_ADDRESS,
        abi: stakingPoolAbi,
        functionName: 'getAllPoolIds',
      });
      setPoolIds(data as `0x${string}`[]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch pool IDs'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    poolIds,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Combined hook for full staking flow with approval check
 */
export function useStakeWithApproval() {
  const { allowance, refetchAllowance, balance } = useStakingToken();
  const {
    approve,
    isPending: isApproving,
    isConfirming: isApprovalConfirming,
    isConfirmed: isApprovalConfirmed,
    error: approvalError,
    reset: resetApproval,
  } = useApproveToken();
  const {
    stake,
    isPending: isStaking,
    isConfirming: isStakeConfirming,
    isConfirmed: isStakeConfirmed,
    error: stakeError,
    hash: stakeHash,
    reset: resetStake,
  } = useStake();

  const stakeWithApproval = useCallback(async (poolId: string, amount: bigint) => {
    console.log('[useStakeWithApproval] Starting stake:', {
      poolId,
      amount: amount.toString(),
      currentAllowance: allowance?.toString(),
      balance: balance?.toString(),
    });

    // Refetch allowance to get the latest value (use returned value, not state)
    const currentAllowance = await refetchAllowance();

    console.log('[useStakeWithApproval] Fresh allowance:', currentAllowance?.toString());

    // Check if we need approval
    if (!currentAllowance || currentAllowance < amount) {
      console.log('[useStakeWithApproval] Approval needed, current allowance:', currentAllowance?.toString());
      // Approve max uint256 for future stakes
      await approve(BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'));
      // Note: The stake will need to be called separately after approval confirms
      return { needsApproval: true };
    }

    console.log('[useStakeWithApproval] Sufficient allowance, proceeding to stake');
    // Stake directly
    await stake(poolId, amount);
    return { needsApproval: false };
  }, [allowance, balance, approve, stake, refetchAllowance]);

  const reset = useCallback(() => {
    resetApproval();
    resetStake();
  }, [resetApproval, resetStake]);

  return {
    stakeWithApproval,
    allowance,
    balance,
    refetchAllowance,
    isApproving: isApproving || isApprovalConfirming,
    isApprovalConfirmed,
    isStaking: isStaking || isStakeConfirming,
    isStakeConfirmed,
    stakeHash,
    error: approvalError || stakeError,
    reset,
  };
}
