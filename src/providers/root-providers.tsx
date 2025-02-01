'use client';

import '@rainbow-me/rainbowkit/styles.css';

import { RainbowKitProvider, DisclaimerComponent } from '@rainbow-me/rainbowkit';
import {
  RainbowKitSiweNextAuthProvider,
  GetSiweMessageOptions,
} from '@rainbow-me/rainbowkit-siwe-next-auth';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { WagmiProvider, type State } from 'wagmi';
import { config } from '@/utils/wagmi';

import { anvil, arbitrum, arbitrumSepolia } from 'wagmi/chains';

const getSiweMessageOptions: GetSiweMessageOptions = () => ({
  statement: 'Sign in to Locale Lending',
});

const queryClient = new QueryClient();

interface RootProviderProps {
  children: React.ReactNode;
  initialState: State | undefined;
  session: Session | null;
}

const Disclaimer: DisclaimerComponent = ({ Text, Link }) => (
  <Text>
    By connecting your wallet, you agree to the{' '}
    <Link href="https://termsofservice.xyz">Terms of Service</Link> and acknowledge you have read
    and understand the protocol <Link href="https://disclaimer.xyz">Disclaimer</Link>
  </Text>
);

const appInfo = {
  appName: 'Locale Lending',
  learnMoreUrl: 'https://locale.network',
  disclaimer: Disclaimer,
};

export default function RootProviders({ children, initialState, session }: RootProviderProps) {
  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider session={session}>
          <RainbowKitSiweNextAuthProvider getSiweMessageOptions={getSiweMessageOptions}>
            <RainbowKitProvider
              appInfo={appInfo}
              initialChain={
                process.env.NEXT_PUBLIC_RPC_URL === 'http://localhost:8545'
                  ? anvil
                  : arbitrumSepolia
              }
            >
              {children}
            </RainbowKitProvider>
          </RainbowKitSiweNextAuthProvider>
        </SessionProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
