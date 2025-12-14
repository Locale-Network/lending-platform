'use client';

import { useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import type { Address } from 'viem';

/**
 * Hook that provides wallet address information for the current user.
 *
 * With Privy, users connect with their EOA wallet directly (no smart accounts).
 * This hook provides a unified interface for accessing the user's wallet address.
 *
 * For backwards compatibility with the previous Alchemy-based system,
 * both smartAccountAddress and eoaAddress return the same wallet address.
 *
 * @returns Object containing:
 *   - smartAccountAddress: The user's wallet address (for compatibility)
 *   - eoaAddress: The user's wallet address
 *   - isLoading: Whether the wallet is still being loaded
 *   - error: Any error that occurred (always null with Privy)
 */
export function useSmartAccountAddress() {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();

  const primaryWallet = wallets[0];
  const address = primaryWallet?.address as Address | undefined;

  // With Privy, we only have EOA addresses (no smart accounts)
  // For backwards compatibility, both point to the same address
  const isLoading = !ready;
  const isConnected = authenticated && !!address;

  // Helper to get shortened address for display
  const shortenAddress = useCallback((addr: Address | undefined): string => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }, []);

  return {
    // Primary addresses (both point to EOA with Privy)
    smartAccountAddress: address,   // For compatibility with existing code
    eoaAddress: address,            // The user's wallet address

    // Derived values (for compatibility)
    localeId: address,              // Alias for address
    displayAddress: address,        // User-facing address

    // Shortened versions for UI
    shortSmartAccount: shortenAddress(address),
    shortEoa: shortenAddress(address),

    // Status
    isLoading,
    isConnected,
    error: null,  // Privy handles errors internally

    // Full account object - not available with Privy
    account: undefined,

    // User data from Privy
    userId: user?.id,
    email: user?.email?.address,
  };
}

export type UseSmartAccountAddressResult = ReturnType<typeof useSmartAccountAddress>;
