'use client';

import { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { signIn } from '@/app/signin/actions';
import { useRouter } from 'next/navigation';
import { getTokenBalanceAction } from '@/app/actions/token';

interface WalletConnectButtonProps {
  label?: string;
}

const WalletConnectButton = ({ label }: WalletConnectButtonProps) => {
  const { isConnecting, address, isConnected } = useAccount();
  const { status } = useSession();
  const [balance, setBalance] = useState<number>(0);
  const router = useRouter();
  useEffect(() => {
    if (status === 'authenticated' && isConnected && address) {
      (async function () {
        await signIn(address);
      })();
    }

    if (status === 'unauthenticated' || !isConnected || !address) {
      router.push('/signin');
    }
  }, [status, isConnected, address, router]);

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

  if (isConnecting) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-[#1A1B1F] px-3 py-[12px] font-medium text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:bg-[#24262B]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <ConnectButton label={label} showBalance={false} />
      <div className="ml-2 flex items-center gap-2">
        <span className="text-sm font-medium">{balance.toString()}</span>
        <span className="text-sm font-medium">MCT</span>
      </div>
    </div>
  );
};

export default WalletConnectButton;
