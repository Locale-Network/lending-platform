'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useMemo } from 'react';

/**
 * Unified wallet authentication hook using Privy
 *
 * This hook provides a consistent interface for wallet authentication.
 * All authentication is handled through Privy.
 */
export function useWalletAuth() {
  const { user, authenticated, ready, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const primaryWallet = wallets[0];

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
