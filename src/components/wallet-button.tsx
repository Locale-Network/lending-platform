'use client';

import dynamic from 'next/dynamic';

// Dynamically import to avoid SSR issues
const PrivyWalletButton = dynamic(() => import('./privy-wallet-button'), {
  ssr: false,
  loading: () => (
    <button className="px-4 py-2 rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed">
      Loading...
    </button>
  ),
});

interface WalletButtonProps {
  label?: string;
  signInScreen?: boolean;
}

/**
 * Unified Wallet Button
 *
 * Uses Privy for all authentication.
 */
export default function WalletButton({ label, signInScreen }: WalletButtonProps) {
  return <PrivyWalletButton label={label} signInScreen={signInScreen} />;
}
