/**
 * Script to mint test tokens to a specified address
 * Usage: npx tsx scripts/mint-tokens.ts <address> <amount>
 * Example: npx tsx scripts/mint-tokens.ts 0x94802e7a5e8bf7871db02888846d948c4d8cc093 10000
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

  if (args.length < 2) {
    console.log('Usage: npx tsx scripts/mint-tokens.ts <address> <amount>');
    console.log('Example: npx tsx scripts/mint-tokens.ts 0x94802e7a5e8bf7871db02888846d948c4d8cc093 10000');
    process.exit(1);
  }

  const recipientAddress = args[0] as `0x${string}`;
  const amountToMint = args[1];

  console.log('='.repeat(60));
  console.log('Locale Lending - Token Minting Script');
  console.log('='.repeat(60));
  console.log(`Token Address: ${TOKEN_ADDRESS}`);
  console.log(`Recipient: ${recipientAddress}`);
  console.log(`Amount: ${amountToMint}`);
  console.log(`RPC URL: ${RPC_URL}`);
  console.log('='.repeat(60));

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

  console.log('Minter role verified');

  // Get balance before
  const balanceBefore = await publicClient.readContract({
    address: TOKEN_ADDRESS,
    abi: tokenAbi,
    functionName: 'balanceOf',
    args: [recipientAddress],
  });

  console.log(`\nBalance before: ${formatUnits(balanceBefore, decimals)} ${symbol}`);

  // Mint tokens
  const amountInWei = parseUnits(amountToMint, decimals);
  console.log(`\nMinting ${amountToMint} ${symbol} (${amountInWei} wei)...`);

  const hash = await walletClient.writeContract({
    address: TOKEN_ADDRESS,
    abi: tokenAbi,
    functionName: 'mint',
    args: [recipientAddress, amountInWei],
  });

  console.log(`Transaction hash: ${hash}`);
  console.log('Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

  // Get balance after
  const balanceAfter = await publicClient.readContract({
    address: TOKEN_ADDRESS,
    abi: tokenAbi,
    functionName: 'balanceOf',
    args: [recipientAddress],
  });

  console.log(`\nBalance after: ${formatUnits(balanceAfter, decimals)} ${symbol}`);
  console.log(`\nSuccessfully minted ${amountToMint} ${symbol} to ${recipientAddress}`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
