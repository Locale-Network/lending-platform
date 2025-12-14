/**
 * Script to mint test tokens to multiple addresses at once
 * Usage: npx tsx scripts/mint-tokens-batch.ts [amount]
 * Example: npx tsx scripts/mint-tokens-batch.ts 10000
 *
 * Default amount is 10000 tokens per wallet
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local'), override: true });

const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS as `0x${string}`;
const ADMIN_PRIVATE_KEY = process.env.POOL_ADMIN_PRIVATE_KEY as `0x${string}`;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';

// Wallets to fund
const WALLETS_TO_FUND: `0x${string}`[] = [
  '0x94802E7a5e8bf7871Db02888846D948C4d8CC093',
  '0x89E61f8702Fe398d7172450F44348F6deBE68D93',
  '0x358391D9C12bE9F21770200cE29db1EB3654eE12',
];

// ERC20 + Mint ABI
const tokenAbi = [
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8', internalType: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasRole',
    inputs: [
      { name: 'role', type: 'bytes32', internalType: 'bytes32' },
      { name: 'account', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
] as const;

async function main() {
  const args = process.argv.slice(2);
  const amountToMint = args[0] || '10000'; // Default 10000 tokens per wallet

  console.log('='.repeat(60));
  console.log('Locale Lending - Batch Token Minting Script');
  console.log('='.repeat(60));
  console.log(`Token Address: ${TOKEN_ADDRESS}`);
  console.log(`Amount per wallet: ${amountToMint}`);
  console.log(`RPC URL: ${RPC_URL}`);
  console.log(`Wallets to fund: ${WALLETS_TO_FUND.length}`);
  console.log('='.repeat(60));

  if (!TOKEN_ADDRESS) {
    console.error('Error: NEXT_PUBLIC_TOKEN_ADDRESS not set in .env.local');
    process.exit(1);
  }

  if (!ADMIN_PRIVATE_KEY) {
    console.error('Error: POOL_ADMIN_PRIVATE_KEY not set in .env.local');
    process.exit(1);
  }

  // Create clients
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(RPC_URL),
  });

  const account = privateKeyToAccount(ADMIN_PRIVATE_KEY);
  console.log(`Minter Account: ${account.address}`);

  const walletClient = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(RPC_URL),
  });

  // Get token info
  const [symbol, decimals] = await Promise.all([
    publicClient.readContract({
      address: TOKEN_ADDRESS,
      abi: tokenAbi,
      functionName: 'symbol',
    }),
    publicClient.readContract({
      address: TOKEN_ADDRESS,
      abi: tokenAbi,
      functionName: 'decimals',
    }),
  ]);

  console.log(`Token Symbol: ${symbol}`);
  console.log(`Token Decimals: ${decimals}`);

  // Check minter role
  const MINTER_ROLE = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6'; // keccak256("MINTER_ROLE")
  const hasMinterRole = await publicClient.readContract({
    address: TOKEN_ADDRESS,
    abi: tokenAbi,
    functionName: 'hasRole',
    args: [MINTER_ROLE as `0x${string}`, account.address],
  });

  if (!hasMinterRole) {
    console.error('\nError: The admin account does not have MINTER_ROLE');
    console.error('Please grant MINTER_ROLE to the account first');
    process.exit(1);
  }

  console.log('Minter role verified\n');

  const amountInWei = parseUnits(amountToMint, decimals);

  // Mint to each wallet
  for (const wallet of WALLETS_TO_FUND) {
    console.log('-'.repeat(60));
    console.log(`Processing: ${wallet}`);

    // Get balance before
    const balanceBefore = await publicClient.readContract({
      address: TOKEN_ADDRESS,
      abi: tokenAbi,
      functionName: 'balanceOf',
      args: [wallet],
    });

    console.log(`  Balance before: ${formatUnits(balanceBefore, decimals)} ${symbol}`);
    console.log(`  Minting ${amountToMint} ${symbol}...`);

    try {
      const hash = await walletClient.writeContract({
        address: TOKEN_ADDRESS,
        abi: tokenAbi,
        functionName: 'mint',
        args: [wallet, amountInWei],
      });

      console.log(`  Transaction hash: ${hash}`);
      console.log('  Waiting for confirmation...');

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  Confirmed in block ${receipt.blockNumber}`);

      // Get balance after
      const balanceAfter = await publicClient.readContract({
        address: TOKEN_ADDRESS,
        abi: tokenAbi,
        functionName: 'balanceOf',
        args: [wallet],
      });

      console.log(`  Balance after: ${formatUnits(balanceAfter, decimals)} ${symbol}`);
      console.log(`  SUCCESS`);
    } catch (error) {
      console.error(`  FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Batch minting complete!');
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
