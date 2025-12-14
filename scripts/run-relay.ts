#!/usr/bin/env npx tsx
/**
 * Standalone relay service runner
 *
 * Usage:
 *   npm run relay:local    # For local Anvil development
 *   npm run relay          # For production/testnet
 *
 * Environment variables:
 *   NEXT_PUBLIC_CHAIN_ID     - Chain ID (31337 for Anvil, 421614 for Sepolia)
 *   NEXT_PUBLIC_RPC_URL      - RPC endpoint
 *   NEXT_PUBLIC_LOAN_POOL_ADDRESS - SimpleLoanPool contract address
 *   RELAY_PRIVATE_KEY        - Private key for relay transactions
 *   CARTESI_GRAPHQL_URL      - Cartesi GraphQL endpoint
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') });

// Dynamic import to ensure env vars are loaded first
async function main() {
  const { startRelayService } = await import('../src/services/relay');

  const pollInterval = parseInt(process.env.RELAY_POLL_INTERVAL || '30000', 10);

  console.log('');
  console.log('===========================================');
  console.log('  Locale Lending - Relay Service');
  console.log('===========================================');
  console.log('');

  try {
    await startRelayService(pollInterval);
  } catch (error) {
    console.error('Failed to start relay service:', error);
    process.exit(1);
  }
}

main().catch(console.error);
