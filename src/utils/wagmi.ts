import { http, createConfig, cookieStorage, createStorage } from 'wagmi';
import { arbitrum, arbitrumSepolia } from 'wagmi/chains';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  walletConnectWallet,
  trustWallet,
} from '@rainbow-me/rainbowkit/wallets';

const projectId = process.env.NEXT_PUBLIC_REOWN_CLOUD_PROJECT_ID;
if (!projectId) {
  throw new Error('REOWN_CLOUD_PROJECT_ID is not set');
}

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [metaMaskWallet, rabbyWallet, rainbowWallet, walletConnectWallet, trustWallet],
    },
  ],
  {
    appName: 'My RainbowKit App',
    projectId,
  }
);

export const config = createConfig({
  connectors,
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  chains: [arbitrumSepolia],
  transports: {
    [arbitrumSepolia.id]: http(),
  },
});
