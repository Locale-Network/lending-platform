'use client';

import { AlchemyAccountProvider } from '@account-kit/react';
import { config } from '@/config/alchemy';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Alchemy Account Kit Provider
 *
 * Wraps the app with Alchemy's smart account functionality:
 * - Email/social login via embedded wallets
 * - Gas sponsorship for transactions
 * - ERC-4337 smart account features
 *
 * This provider handles authentication at the wallet/account level.
 * Session data is synced to Supabase via the auth sync endpoint.
 */

const queryClient = new QueryClient();

export function AlchemyProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AlchemyAccountProvider config={config} queryClient={queryClient}>
        {children}
      </AlchemyAccountProvider>
    </QueryClientProvider>
  );
}
