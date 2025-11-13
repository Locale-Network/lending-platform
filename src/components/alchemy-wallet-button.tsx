'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AlchemyWalletButtonProps {
  label?: string;
  signInScreen?: boolean;
}

// Dynamically import the inner component to avoid SSR issues with Alchemy hooks
const AlchemyWalletButtonInner = dynamic(() => import('./alchemy-wallet-button-inner'), {
  ssr: false,
  loading: () => (
    <Button disabled className="gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading...
    </Button>
  ),
});

export default function AlchemyWalletButton(props: AlchemyWalletButtonProps) {
  return <AlchemyWalletButtonInner {...props} />;
}
