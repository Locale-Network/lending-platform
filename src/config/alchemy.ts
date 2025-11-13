import { createConfig, cookieStorage, AlchemyAccountsUIConfig } from '@account-kit/react';
import { arbitrum, arbitrumSepolia } from '@account-kit/infra';
import { alchemy } from '@account-kit/infra';
/**
 * Alchemy Account Kit Configuration
 *
 * This configures the embedded wallet system for authentication:
 * - Email login (passwordless)
 * - Social login (Google, Apple, etc.)
 * - Passkey authentication
 * - Traditional wallet connections
 *
 * Features:
 * - Gas sponsorship via Alchemy Gas Manager
 * - ERC-4337 smart accounts
 * - Session key management
 * - Cookie-based storage for SSR consistency
 */

const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '';
const gasManagerConfig = process.env.NEXT_PUBLIC_GAS_POLICY_ID
  ? {
      policyId: process.env.NEXT_PUBLIC_GAS_POLICY_ID,
    }
  : undefined;

// Only throw error if apiKey is actually needed (not during build)
if (!apiKey && typeof window !== 'undefined') {
  console.warn(
    'NEXT_PUBLIC_ALCHEMY_API_KEY is not set. Alchemy Account Kit features will be disabled.'
  );
}

const uiConfig: AlchemyAccountsUIConfig = {
  illustrationStyle: 'outline',
  auth: {
    sections: [
      [{ type: 'email' }],
      [
        { type: 'passkey' },
        { type: 'social', authProviderId: 'google', mode: 'popup' },
        { type: 'social', authProviderId: 'facebook', mode: 'popup' },
      ],
      [
        {
          type: 'external_wallets',
          walletConnect: { projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '' },
          wallets: ['metamask','rainbow','trust','rabby','wallet_connect'],
          moreButtonText: 'More wallets',
          hideMoreButton: false,
          numFeaturedWallets: 1,
        },
      ],
    ],
    addPasskeyOnSignup: false,
  },
};

export const config = createConfig(
  {
    // Use arbitrum mainnet in production, sepolia for testing
    chain: process.env.NODE_ENV === 'production' ? arbitrum : arbitrumSepolia,

    // Optional: Gas sponsorship policy
    ...(gasManagerConfig && { gasManagerConfig }),

    // SSR support for Next.js with cookie storage for state persistence
    ssr: true,
    storage: cookieStorage,

    // Transport configuration - use API route for SSR compatibility
    // API key is handled server-side in the /api/rpc route
    transport: alchemy({ rpcUrl: '/api/rpc' }),

    // Enable popup OAuth for social logins
    enablePopupOauth: true,
  },
  uiConfig
);
