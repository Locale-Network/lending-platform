'use client';

import '@rainbow-me/rainbowkit/styles.css';

import { RainbowKitProvider, DisclaimerComponent, } from '@rainbow-me/rainbowkit';
import {
  RainbowKitSiweNextAuthProvider,
  GetSiweMessageOptions,
} from '@rainbow-me/rainbowkit-siwe-next-auth';
import { SessionProvider } from 'next-auth/react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { WagmiProvider, type State } from 'wagmi';
import { config } from '@/utils/wagmi';

import { arbitrum } from 'wagmi/chains';

const getSiweMessageOptions: GetSiweMessageOptions = () => ({
  statement: 'Sign in to MY APP',
});

const queryClient = new QueryClient();

interface RootProviderProps {
  children: React.ReactNode;
  initialState: State | undefined;
}


const Disclaimer: DisclaimerComponent = ({ Text, Link }) => (
  <Text>
    By connecting your wallet, you agree to the{' '}
    <Link href="https://termsofservice.xyz">Terms of Service</Link> and
    acknowledge you have read and understand the protocol{' '}
    <Link href="https://disclaimer.xyz">Disclaimer</Link>
  </Text>
);

const appInfo = {
  appName: 'Locale Network',
  learnMoreUrl: 'https://locale.network',
  disclaimer: Disclaimer,
};

export default function RootProviders({ children, initialState }: RootProviderProps) {
  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <RainbowKitSiweNextAuthProvider getSiweMessageOptions={getSiweMessageOptions}>
            <RainbowKitProvider appInfo={appInfo}  initialChain={arbitrum}>{children}</RainbowKitProvider>
          </RainbowKitSiweNextAuthProvider>
        </SessionProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
