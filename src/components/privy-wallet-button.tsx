'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Loader2, LogOut, Settings, Wallet } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { getStakingTokenBalanceAction } from '@/app/actions/token';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ROLE_REDIRECTS } from '@/app/api/auth/auth-pages';
import { Role } from '@prisma/client';

interface PrivyWalletButtonProps {
  label?: string;
  signInScreen?: boolean;
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
  // Default to wallet for external wallet connections
  return 'wallet';
}

/**
 * Get the wallet address that is actually LINKED to the current Privy user.
 *
 * IMPORTANT: We use user.linkedAccounts instead of useWallets() because:
 * - useWallets() returns ALL connected wallets, including external wallets that
 *   Privy treats as SEPARATE users (not linked to the current email user)
 * - user.linkedAccounts only contains wallets that belong to THIS Privy user
 *
 * This prevents the bug where an email user connects a Metamask wallet that
 * exists as a separate Privy user, causing wrong Privy ID to be synced with
 * the wallet address in the database.
 */
function getLinkedWalletAddress(user: ReturnType<typeof usePrivy>['user']): string | undefined {
  if (!user?.linkedAccounts) return undefined;

  // Find a wallet account in the user's linked accounts
  // Prioritize embedded wallets (type === 'wallet' with walletClient 'privy')
  // then fall back to any linked wallet
  const linkedWallets = user.linkedAccounts
    .filter(account => account.type === 'wallet' && 'address' in account)
    .map(account => account as { type: 'wallet'; address: string; walletClient?: string });

  if (linkedWallets.length === 0) return undefined;

  // Prefer embedded wallet (privy) over external wallets
  const embeddedWallet = linkedWallets.find(w => w.walletClient === 'privy');
  if (embeddedWallet) return embeddedWallet.address;

  // Otherwise use the first linked wallet
  return linkedWallets[0]?.address;
}

export default function PrivyWalletButton({
  label = 'Connect Wallet',
  signInScreen = false,
}: PrivyWalletButtonProps) {
  const { login, logout, ready, authenticated, user } = usePrivy();
  const [balance, setBalance] = useState<number>(0);
  const [tokenSymbol, setTokenSymbol] = useState<string>('USDC');
  const [isSyncing, setIsSyncing] = useState(false);
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Get wallet address from user.linkedAccounts (NOT from useWallets())
  // This ensures we only use wallets actually linked to this Privy user
  const address = getLinkedWalletAddress(user);
  const isConnected = authenticated && !!address;

  // Track if we've already synced this session to prevent duplicate calls
  // Using both ref (for synchronous check) and state (for re-render)
  const [hasSynced, setHasSynced] = useState(false);
  const syncingRef = useRef(false); // Ref to prevent race conditions

  // Sync Privy auth with Supabase Account table
  const syncAuthToSupabase = useCallback(async () => {
    // Synchronous check using ref to prevent race conditions
    if (syncingRef.current) return;
    if (!address || !user?.id) return;

    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const email = user?.email?.address;
      const privyUserId = user.id;
      const authProvider = getAuthProvider(user);

      // Debug log to verify we're using the correct wallet address
      console.log('[PrivyWallet] Syncing to Supabase:', {
        address,
        privyUserId,
        email,
        authProvider,
        linkedAccountsCount: user?.linkedAccounts?.length || 0,
        linkedWallets: user?.linkedAccounts?.filter(a => a.type === 'wallet').map(a => ({
          address: 'address' in a ? a.address : 'N/A',
          type: a.type,
        })),
      });

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
        const errorData = await response.json();
        console.error('[PrivyWallet] Sync failed:', errorData);

        // Handle 409 Conflict - account exists with different wallet
        if (response.status === 409) {
          console.error('[PrivyWallet] Wallet conflict detected:', errorData.message);
          // Show user-friendly error - they should use their original wallet
          alert(`This Privy account is already linked to a different wallet address (${errorData.existingAddress?.slice(0, 6)}...${errorData.existingAddress?.slice(-4)}). Please disconnect and connect with your original wallet.`);
          await logout();
        }

        syncingRef.current = false; // Reset ref on error so retry is possible
        setIsSyncing(false);
        return;
      }

      const data = await response.json();
      console.log('[PrivyWallet] Sync successful:', data);

      // Store auth state locally for client-side use
      const newAuthState: AuthState = {
        address,
        role: data.account?.role || Role.INVESTOR,
        privyUserId,
        email,
      };
      setAuthState(newAuthState);
      setHasSynced(true);

      // Store in sessionStorage for persistence across page navigations
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('privyAuthState', JSON.stringify(newAuthState));
      }

      setIsSyncing(false);
    } catch (error) {
      console.error('[PrivyWallet] Failed to sync auth:', error);
      syncingRef.current = false; // Reset ref on error so retry is possible
      setIsSyncing(false);
    }
  }, [address, user]);

  // Load auth state from sessionStorage on mount (before sync check)
  useEffect(() => {
    if (typeof window !== 'undefined' && address) {
      const stored = sessionStorage.getItem('privyAuthState');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Only use stored state if address matches
          if (parsed.address === address) {
            setAuthState(parsed);
            setHasSynced(true); // Mark as synced if we have stored state
            syncingRef.current = true; // Also set ref to prevent duplicate syncs
          }
        } catch {
          // Invalid stored data, ignore
        }
      }
    }
  }, [address]);

  // Sync when connected and not yet synced (only once per session)
  useEffect(() => {
    if (isConnected && address && user?.id && !authState && !isSyncing && !hasSynced) {
      syncAuthToSupabase();
    }
  }, [isConnected, address, user?.id, authState, isSyncing, hasSynced, syncAuthToSupabase]);

  // Clear auth state when disconnected
  useEffect(() => {
    if (!authenticated && authState) {
      setAuthState(null);
      setHasSynced(false); // Reset so next login will sync
      syncingRef.current = false; // Reset ref so next login can sync
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('privyAuthState');
      }
    }
  }, [authenticated, authState]);

  // Redirect authenticated users to their dashboard (on sign-in screen only)
  useEffect(() => {
    console.log('[PrivyWallet] Redirect check:', {
      hasAuthState: !!authState,
      role: authState?.role,
      signInScreen,
      pathname
    });

    if (authState?.role && signInScreen) {
      const role = authState.role as keyof typeof ROLE_REDIRECTS;
      const redirectPath = ROLE_REDIRECTS[role];

      if (redirectPath) {
        console.log('[PrivyWallet] Redirecting to:', redirectPath);
        // Use replace to prevent back button returning to signin
        router.replace(redirectPath);
      }
    }
  }, [authState, router, signInScreen, pathname]);

  // Redirect unauthenticated users away from protected pages
  useEffect(() => {
    const isProtectedPath = pathname.startsWith('/explore') ||
                           pathname.startsWith('/borrower') ||
                           pathname.startsWith('/approver') ||
                           pathname.startsWith('/admin');

    const shouldRedirect =
      ready &&
      !authenticated &&
      !signInScreen &&
      isProtectedPath &&
      !isSyncing;

    if (shouldRedirect) {
      const timeoutId = setTimeout(() => {
        router.push('/signin');
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [ready, authenticated, signInScreen, pathname, isSyncing, router]);

  // Fetch token balance
  useEffect(() => {
    if (isConnected && address) {
      (async function () {
        const result = await getStakingTokenBalanceAction(address);
        setBalance(result.balance);
        setTokenSymbol(result.symbol);
      })();

      const intervalId = setInterval(async () => {
        const result = await getStakingTokenBalanceAction(address);
        setBalance(result.balance);
        setTokenSymbol(result.symbol);
      }, 4000);

      return () => clearInterval(intervalId);
    }
  }, [isConnected, address]);

  const handleDisconnect = async () => {
    // Clear local auth state
    setAuthState(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('privyAuthState');
    }
    await logout();
    router.push('/signin');
  };

  // Loading state
  if (!ready) {
    return (
      <Button disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  // Syncing state
  if (isSyncing) {
    return (
      <Button disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Connecting...
      </Button>
    );
  }

  // Connected state
  if (isConnected && address) {
    const shortenedAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-0 rounded-full bg-white hover:bg-gray-50 transition-colors cursor-pointer border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 pl-2 pr-3 py-2">
              <img src="/usdc-logo.png" alt="USDC" className="w-6 h-6 rounded-full" />
              <span className="text-sm font-medium text-gray-900">
                {balance.toFixed(3)} {tokenSymbol}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2 mr-0.5">
              <span className="text-sm font-mono text-gray-600">{shortenedAddress}</span>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="font-mono text-xs">{shortenedAddress}</DropdownMenuItem>
          {authState?.role && (
            <DropdownMenuItem className="text-xs text-muted-foreground">
              Role: {authState.role}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              // Use role-aware navigation - BORROWER uses /borrower/account, others use /explore/portfolio
              const path = authState?.role === 'BORROWER' ? '/borrower/account' : '/explore/portfolio';
              router.push(path);
            }}
            className="cursor-pointer"
          >
            <Wallet className="mr-2 h-4 w-4" />
            {authState?.role === 'BORROWER' ? 'Account' : 'Portfolio'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              // Use role-aware navigation - BORROWER uses /borrower/account, others use /explore/settings
              const path = authState?.role === 'BORROWER' ? '/borrower/account' : '/explore/settings';
              router.push(path);
            }}
            className="cursor-pointer"
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDisconnect} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Disconnected state
  return <Button onClick={login}>{label}</Button>;
}

// Export a hook for other components to access auth state
export function usePrivyAuthState(): AuthState | null {
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
