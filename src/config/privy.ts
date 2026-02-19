'use client';

import type { PrivyClientConfig } from '@privy-io/react-auth';
import { arbitrum, arbitrumSepolia } from 'viem/chains';

const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID ? parseInt(process.env.NEXT_PUBLIC_CHAIN_ID, 10) : undefined;

function getDefaultChain() {
  switch (CHAIN_ID) {
    case 421614: return arbitrumSepolia;
    case 42161: return arbitrum;
    default: return arbitrum;
  }
}

/**
 * Privy Configuration
 *
 * Auth: Privy (email, Google, wallet login)
 * Gas sponsorship: Alchemy Smart Wallets, configured in Privy dashboard
 */

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;

export const privyConfig: PrivyClientConfig = {
  defaultChain: getDefaultChain(),
  supportedChains: [arbitrumSepolia, arbitrum],

  // Custom RPC URLs — overrides Privy's default RPC proxy which can be unreliable
  ...(RPC_URL && CHAIN_ID ? {
    rpcConfig: {
      rpcUrls: {
        [CHAIN_ID]: RPC_URL,
      },
    },
  } : {}),

  // Login methods
  loginMethods: ['email', 'google', 'wallet'],

  // Appearance
  appearance: {
    theme: 'light',
    accentColor: '#2563eb', // Blue to match your branding
    logo: '/locale-logo.svg',
    showWalletLoginFirst: false,
  },

  // Embedded wallet configuration (create for users without wallets)
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets',
    },
  },

  // Legal
  legal: {
    termsAndConditionsUrl: 'https://locale.finance/terms',
    privacyPolicyUrl: 'https://locale.finance/privacy',
  },
};

// Privy App ID from environment
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';
