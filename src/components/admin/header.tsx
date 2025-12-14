'use client';

import WalletButton from '@/components/wallet-button';
import { usePathname } from 'next/navigation';

// TODO: improve this with forward ref

const ROUTE_TITLES: Record<string, string> = {
  '/admin': 'Home',
  '/approver': 'Dashboard',
};

export default function BorrowerHeader() {
  const pathname = usePathname();

  const title = ROUTE_TITLES[pathname];

  return (
    <header className="flex-1 border-b border-gray-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/40">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="flex items-center space-x-4">
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
