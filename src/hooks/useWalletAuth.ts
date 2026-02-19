'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useMemo } from 'react';

/**
 * Get the preferred wallet address from Privy user's linked accounts.
 * Matches the logic used in privy-wallet-button.tsx to keep addresses consistent.
 * Prefers embedded wallets (Privy-managed) over external wallets.
 */
function getLinkedWalletAddress(user: ReturnType<typeof usePrivy>['user']): string | undefined {
  if (!user?.linkedAccounts) return undefined;

  const linkedWallets = user.linkedAccounts
    .filter(account => account.type === 'wallet' && 'address' in account)
    .map(account => account as { type: 'wallet'; address: string; walletClient?: string });

  if (linkedWallets.length === 0) return undefined;

  const embeddedWallet = linkedWallets.find(w => w.walletClient === 'privy');
  if (embeddedWallet) return embeddedWallet.address;

  return linkedWallets[0]?.address;
}

/**
 * Unified wallet authentication hook using Privy
 *
 * This hook provides a consistent interface for wallet authentication.
 * All authentication is handled through Privy.
 */
export function useWalletAuth() {
  const { user, authenticated, ready, login, logout } = usePrivy();
  const { wallets } = useWallets();

  // Use the same address resolution as the header (getLinkedWalletAddress)
  // to ensure balance queries and transactions use the correct wallet.
  const linkedAddress = getLinkedWalletAddress(user);

  // Find the matching wallet object for transaction signing
  const primaryWallet = useMemo(() => {
    if (!linkedAddress) return wallets[0];
    return wallets.find(w => w.address.toLowerCase() === linkedAddress.toLowerCase()) || wallets[0];
  }, [wallets, linkedAddress]);

  return useMemo(() => ({
    // Core properties
    address: primaryWallet?.address,
    email: user?.email?.address,
    userId: user?.id,

    // Connection status
    isConnected: authenticated && !!primaryWallet,
    isInitializing: !ready,
    ready,

    // Auth actions
    login,
    logout,

    // Raw access
    user,
    wallet: primaryWallet,

    // Source indicator
    authSource: 'privy' as const,
  }), [user, authenticated, ready, login, logout, primaryWallet]);
}

/**
 * Hook to get just the wallet address
 * Useful for components that only need the address
 */
export function useWalletAddress() {
  const { address, isConnected } = useWalletAuth();
  return { address, isConnected };
}

/**
 * Hook for auth status checks
 */
export function useAuthStatus() {
  const { isConnected, isInitializing, ready, authSource } = useWalletAuth();
  return { isConnected, isInitializing, ready, authSource };
}
