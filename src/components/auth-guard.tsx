'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { Role } from '@prisma/client';
import LoadingDots from '@/components/ui/loading-dots';

/**
 * Get the preferred wallet address from Privy user's linked accounts.
 * Prefers embedded wallets (Privy-managed) over external wallets.
 * Matches the logic in useWalletAuth.ts and privy-wallet-button.tsx.
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

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: Role | Role[];
  fallbackUrl?: string;
}

interface AuthState {
  address: string;
  role: Role;
  privyUserId: string;
  email?: string;
}

// Helper to determine auth provider from Privy user data
function getAuthProvider(user: ReturnType<typeof usePrivy>['user']): 'email' | 'google' | 'apple' | 'passkey' | 'wallet' {
  if (user?.email?.address) return 'email';
  if (user?.google) return 'google';
  if (user?.apple) return 'apple';
  return 'wallet';
}

/**
 * AuthGuard - Client-side authentication wrapper using Privy
 *
 * Handles authentication state, syncs user data to Supabase,
 * and manages role-based access control.
 */
export default function AuthGuard({
  children,
  requiredRole,
  fallbackUrl = '/signin',
}: AuthGuardProps) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const router = useRouter();

  const [isSyncing, setIsSyncing] = useState(false);
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [authComplete, setAuthComplete] = useState(false);
  const [walletWaitCount, setWalletWaitCount] = useState(0);
  const [hasSyncedThisSession, setHasSyncedThisSession] = useState(false);

  // Use linked wallet address (same resolution as useWalletAuth/privy-wallet-button)
  // to avoid using the wrong embedded wallet address from wallets[0]
  const linkedAddress = getLinkedWalletAddress(user);
  const address = useMemo(() => {
    if (linkedAddress) return linkedAddress;
    return wallets[0]?.address;
  }, [linkedAddress, wallets]);
  const isConnected = authenticated && !!address;

  // Sync Privy auth with Supabase Account table
  const syncAuthToSupabase = useCallback(async () => {
    if (!address || !user?.id || isSyncing) return;

    setIsSyncing(true);
    try {
      const email = user?.email?.address;
      const privyUserId = user.id;
      const authProvider = getAuthProvider(user);

      const response = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          privyUserId,
          email: email || undefined,
          authProvider,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { raw: errorText };
        }
        setIsSyncing(false);
        return;
      }

      const data = await response.json();
      console.log('[AuthGuard] Sync response:', data);

      // Store auth state locally for client-side use
      const newAuthState: AuthState = {
        address,
        role: data.account?.role || Role.INVESTOR,
        privyUserId,
        email,
      };
      console.log('[AuthGuard] Setting auth state with role:', newAuthState.role);
      setAuthState(newAuthState);
      setHasSyncedThisSession(true);

      // Store in sessionStorage for persistence across page navigations
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('privyAuthState', JSON.stringify(newAuthState));
      }

      setIsSyncing(false);
    } catch (error) {
      setIsSyncing(false);
      setHasSyncedThisSession(true); // Mark as synced even on error to prevent infinite loops
    }
  }, [address, user, isSyncing]);

  // Load auth state from sessionStorage on mount (for initial render only)
  // We'll always re-sync with the server to get the latest role
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('privyAuthState');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          console.log('[AuthGuard] Loading from sessionStorage:', {
            storedRole: parsed?.role,
            storedAddress: parsed?.address,
            currentAddress: address,
            addressMatch: parsed?.address === address
          });
          // Only use stored state if address matches (for initial render)
          if (parsed.address === address) {
            setAuthState(parsed);
          }
        } catch {
          // Invalid stored data, ignore
        }
      }
    }
  }, [address]);

  // Wait for wallets to be ready when authenticated without address
  useEffect(() => {
    if (ready && authenticated && user?.id && !address && walletsReady && walletWaitCount < 10) {
      // Authenticated but no wallet yet - wallet might still be creating
      const timer = setTimeout(() => {
        setWalletWaitCount(prev => prev + 1);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [ready, authenticated, user?.id, address, walletsReady, walletWaitCount]);

  // Sync when connected - always sync once per session to get latest role from server
  useEffect(() => {
    if (isConnected && address && user?.id && !hasSyncedThisSession && !isSyncing) {
      syncAuthToSupabase();
    }
  }, [isConnected, address, user?.id, hasSyncedThisSession, isSyncing, syncAuthToSupabase]);

  // Clear auth state when disconnected
  useEffect(() => {
    if (!authenticated && authState) {
      setAuthState(null);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('privyAuthState');
      }
    }
  }, [authenticated, authState]);

  // Check auth completion and handle redirects
  useEffect(() => {
    // DEBUG: Log all state at start of every check
    console.log('[AuthGuard] Auth completion check:', {
      ready,
      walletsReady,
      isSyncing,
      hasSyncedThisSession,
      isConnected,
      authStateRole: authState?.role,
      requiredRole,
      fallbackUrl,
      currentPath: typeof window !== 'undefined' ? window.location.pathname : 'unknown'
    });

    if (!ready) return;
    if (!walletsReady) return; // Wait for wallets to be ready
    if (isSyncing) return;
    if (!hasSyncedThisSession && isConnected) {
      console.log('[AuthGuard] Waiting for sync to complete before role check');
      return; // Wait for sync to complete
    }

    // If authenticated with synced state
    if (isConnected && authState) {
      // Check role requirements
      if (requiredRole) {
        const userRole = authState.role;
        const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

        console.log('[AuthGuard] Role check:', { userRole, requiredRole: roles, includes: roles.includes(userRole) });

        if (!roles.includes(userRole)) {
          console.log('[AuthGuard] ROLE MISMATCH - REDIRECTING:', {
            userRole,
            requiredRoles: roles,
            fallbackUrl,
            currentPath: typeof window !== 'undefined' ? window.location.pathname : 'unknown'
          });
          router.push(fallbackUrl);
          return;
        }
      }
      console.log('[AuthGuard] Auth complete - user has correct role');
      setAuthComplete(true);
      return;
    }

    // Still syncing, wait
    if (isConnected && !authState) return;

    // Authenticated but waiting for wallet, keep waiting
    if (authenticated && !address && walletWaitCount < 10) {
      return;
    }

    // Authenticated but wallet never showed up after timeout - show error
    if (authenticated && !address && walletWaitCount >= 10) {
      // Don't redirect - show an error state instead
      return;
    }

    // Not authenticated, redirect
    const timeoutId = setTimeout(() => {
      router.push(fallbackUrl);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [ready, walletsReady, isSyncing, isConnected, authState, requiredRole, fallbackUrl, router, authenticated, address, walletWaitCount, hasSyncedThisSession]);

  // Show error if wallet never became available
  if (authenticated && !address && walletWaitCount >= 10) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-md px-4">
          <div className="text-destructive text-lg font-semibold">Wallet Setup Issue</div>
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t set up your wallet. This can happen if your browser blocks third-party cookies
            or has strict privacy settings.
          </p>
          <p className="text-sm text-muted-foreground">
            Please try refreshing the page or signing in again.
          </p>
        </div>
      </div>
    );
  }

  if (!authComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingDots size="md" />
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Hook to access auth state from AuthGuard
 */
export function useAuthState(): AuthState | null {
  const [authState, setAuthState] = useState<AuthState | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('privyAuthState');
      if (stored) {
        try {
          setAuthState(JSON.parse(stored));
        } catch {
          // Invalid stored data
        }
      }
    }
  }, []);

  return authState;
}
