import 'server-only';

import { PrivyClient } from '@privy-io/node';
import { createViemAccount } from '@privy-io/node/viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import { arbitrum, arbitrumSepolia } from 'viem/chains';
import type { Chain, WalletClient, PublicClient, LocalAccount } from 'viem';

// Singleton PrivyClient for wallet operations (separate from auth PrivyClient)
let _privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (!_privyClient) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error('NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET must be set');
    }
    _privyClient = new PrivyClient({ appId, appSecret });
  }
  return _privyClient;
}

function getChain(): Chain {
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID
    ? parseInt(process.env.NEXT_PUBLIC_CHAIN_ID, 10)
    : undefined;
  if (!chainId) throw new Error('NEXT_PUBLIC_CHAIN_ID not configured');
  switch (chainId) {
    case 42161: return arbitrum;
    case 421614: return arbitrumSepolia;
    default: throw new Error(`Unsupported NEXT_PUBLIC_CHAIN_ID: ${chainId}`);
  }
}

function getRpcUrl(): string {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
  if (!rpcUrl) throw new Error('NEXT_PUBLIC_RPC_URL not configured');
  return rpcUrl;
}

function getAuthorizationContext() {
  const key = process.env.PRIVY_AUTH_PRIVATE_KEY;
  if (!key) return undefined;
  return { authorization_private_keys: [key] };
}

export interface PrivyWalletClients {
  walletClient: WalletClient;
  publicClient: PublicClient;
  account: LocalAccount;
  chain: Chain;
}

export function createLoanOpsWalletClient(): PrivyWalletClients {
  const walletId = process.env.LOAN_OPS_WALLET_ID;
  const address = process.env.LOAN_OPS_WALLET_ADDRESS;
  if (!walletId || !address) {
    throw new Error('LOAN_OPS_WALLET_ID and LOAN_OPS_WALLET_ADDRESS must be set');
  }

  const privy = getPrivyClient();
  const authorizationContext = getAuthorizationContext();

  const account = createViemAccount(privy, {
    walletId,
    address: address as `0x${string}`,
    ...(authorizationContext ? { authorizationContext } : {}),
  });

  const chain = getChain();
  const rpcUrl = getRpcUrl();
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  return { walletClient, account, publicClient, chain };
}

export function createPoolAdminWalletClient(): PrivyWalletClients {
  const walletId = process.env.POOL_ADMIN_WALLET_ID;
  const address = process.env.POOL_ADMIN_WALLET_ADDRESS;
  if (!walletId || !address) {
    throw new Error('POOL_ADMIN_WALLET_ID and POOL_ADMIN_WALLET_ADDRESS must be set');
  }

  const privy = getPrivyClient();
  const authorizationContext = getAuthorizationContext();

  const account = createViemAccount(privy, {
    walletId,
    address: address as `0x${string}`,
    ...(authorizationContext ? { authorizationContext } : {}),
  });

  const chain = getChain();
  const rpcUrl = getRpcUrl();
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  return { walletClient, account, publicClient, chain };
}

export function getPoolAdminWalletAddress(): string {
  const address = process.env.POOL_ADMIN_WALLET_ADDRESS;
  if (!address) throw new Error('POOL_ADMIN_WALLET_ADDRESS not configured');
  return address;
}

// Shared read-only client for non-signing operations
let _publicClient: PublicClient | null = null;

export function createSharedPublicClient(): PublicClient {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: getChain(),
      transport: http(getRpcUrl()),
    });
  }
  return _publicClient;
}
