'use client';

import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AlchemyAccountProvider } from '@account-kit/react';
import { config as alchemyConfig } from '@/config/alchemy';

const queryClient = new QueryClient();

interface RootProviderProps {
  children: React.ReactNode;
  session: Session | null;
}

export default function RootProviders({ children, session }: RootProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AlchemyAccountProvider config={alchemyConfig} queryClient={queryClient}>
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </AlchemyAccountProvider>
    </QueryClientProvider>
  );
}
