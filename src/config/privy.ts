'use client';

import type { PrivyClientConfig } from '@privy-io/react-auth';

/**
 * Privy Configuration
 *
 * Replaces Alchemy Account Kit for authentication.
 * Alchemy is still used for gas sponsorship via smart accounts.
 */

export const privyConfig: PrivyClientConfig = {
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
