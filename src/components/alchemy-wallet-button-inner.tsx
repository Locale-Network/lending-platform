'use client';

import { useEffect, useState } from 'react';
import { useUser, useAuthModal, useLogout, useSignerStatus } from '@account-kit/react';
import { Loader2, LogOut } from 'lucide-react';
import { useSession, signOut, signIn as nextAuthSignIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { getTokenBalanceAction } from '@/app/actions/token';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AlchemyWalletButtonInnerProps {
  label?: string;
  signInScreen?: boolean;
}

export default function AlchemyWalletButtonInner({ label = 'Connect Wallet', signInScreen = false }: AlchemyWalletButtonInnerProps) {
  const user = useUser();
  const { openAuthModal } = useAuthModal();
  const { logout } = useLogout();
  const signerStatus = useSignerStatus();
  const { status } = useSession();
  const [balance, setBalance] = useState<number>(0);
  const router = useRouter();

  const address = user?.address;
  const isConnected = signerStatus.isConnected && !!address;
  const isInitializing = signerStatus.isInitializing;

  // Sync Alchemy auth with NextAuth
  useEffect(() => {
    if (isConnected && address && status !== 'authenticated') {
      // When Alchemy wallet is connected, trigger NextAuth signin with 'alchemy' provider
      // This will automatically create the user in the database via the provider's authorize function
      (async function () {
        try {
          // Get additional user data from Alchemy
          const alchemyUserId = user?.userId;
          const email = user?.email;

          const result = await nextAuthSignIn('alchemy', {
            address,
            alchemyUserId: alchemyUserId || '',
            email: email || '',
            redirect: false,
          });

          if (result?.ok) {
            // Redirect to investor dashboard after successful signin
            window.location.href = '/explore';
          } else {
            console.error('Failed to sign in with Alchemy:', result?.error);
          }
        } catch (error) {
          console.error('Failed to sync Alchemy auth with NextAuth:', error);
        }
      })();
    }
  }, [status, isConnected, address, user]);

  // Separate effect to handle redirecting unauthenticated users
  // Only redirect when actually unauthenticated, not when Alchemy is disconnected
  useEffect(() => {
    if (status === 'unauthenticated' && !signInScreen) {
      router.push('/signin');
    }
  }, [status, signInScreen, router]);

  // Fetch token balance
  useEffect(() => {
    if (isConnected && address) {
      // Initial balance check
      (async function () {
        const balance = await getTokenBalanceAction(address);
        setBalance(balance);
      })();

      // Set up interval for periodic balance checks
      const intervalId = setInterval(async () => {
        const balance = await getTokenBalanceAction(address);
        setBalance(balance);
      }, 4000);

      // Cleanup interval on unmount or when dependencies change
      return () => clearInterval(intervalId);
    }
  }, [isConnected, address]);

  const handleDisconnect = async () => {
    await logout();
    await signOut();
  };

  if (isInitializing) {
    return (
      <Button disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Connecting...
      </Button>
    );
  }

  if (isConnected && address) {
    const shortenedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
          <span className="text-sm font-medium">{balance.toFixed(2)}</span>
          <span className="text-sm text-muted-foreground">MCT</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="font-mono">
              {shortenedAddress}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="font-mono text-xs">
              {address}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDisconnect} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <Button onClick={openAuthModal}>
      {label}
    </Button>
  );
}
