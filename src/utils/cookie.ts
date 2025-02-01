import { http, createConfig, cookieStorage, createStorage } from 'wagmi';
import { arbitrum, arbitrumSepolia } from 'wagmi/chains';

export const config = createConfig({
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  chains: [arbitrumSepolia],
  transports: {
    [arbitrumSepolia.id]: http(),
  },
});
