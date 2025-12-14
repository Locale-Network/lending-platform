#!/usr/bin/env npx tsx
/**
 * Seed and Deploy Pools Script
 *
 * Creates sample pools in the database and deploys them to the StakingPool smart contract.
 *
 * Usage:
 *   npx tsx scripts/seed-and-deploy-pools.ts           # Deploy to configured chain
 *   npx tsx scripts/seed-and-deploy-pools.ts --dry-run # Preview without deploying
 *
 * Environment variables:
 *   POOL_ADMIN_PRIVATE_KEY       - Private key for pool admin transactions
 *   NEXT_PUBLIC_STAKING_POOL_ADDRESS - StakingPool contract address
 *   NEXT_PUBLIC_RPC_URL          - RPC endpoint
 *   DATABASE_URL                 - Prisma database URL
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient, PoolType, PoolStatus } from '@prisma/client';
import { createPublicClient, createWalletClient, http, parseUnits, keccak256, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';

// Load environment variables from .env.local (with override to ensure fresh values)
config({ path: resolve(__dirname, '../.env.local'), override: true });

const prisma = new PrismaClient();

// Sample pools to seed
// PoolType values: SMALL_BUSINESS, REAL_ESTATE, CONSUMER, MIXED
const SAMPLE_POOLS = [
  {
    name: 'Small Business Growth Fund',
    slug: 'small-business-growth',
    description: 'Support local small businesses with working capital loans. Diversified portfolio across multiple industries with moderate risk.',
    poolType: 'SMALL_BUSINESS' as PoolType,
    poolSize: 500000,
    minimumStake: 1000,
    managementFeeRate: 1.0,
    performanceFeeRate: 10.0,
    baseInterestRate: 8.0,
    riskPremiumMin: 2.0,
    riskPremiumMax: 5.0,
    minCreditScore: 650,
    maxLTV: 0.75,
    allowedIndustries: ['retail', 'services', 'food', 'manufacturing'],
    isFeatured: true,
  },
  {
    name: 'Real Estate Bridge Loans',
    slug: 'real-estate-bridge',
    description: 'Short-term bridge financing for real estate transactions. Lower risk with property-backed collateral.',
    poolType: 'REAL_ESTATE' as PoolType,
    poolSize: 1000000,
    minimumStake: 5000,
    managementFeeRate: 0.75,
    performanceFeeRate: 8.0,
    baseInterestRate: 6.0,
    riskPremiumMin: 1.5,
    riskPremiumMax: 3.5,
    minCreditScore: 700,
    maxLTV: 0.65,
    allowedIndustries: ['real_estate'],
    isFeatured: true,
  },
  {
    name: 'Consumer Loans Portfolio',
    slug: 'consumer-loans',
    description: 'Diversified consumer lending portfolio with personal loans, auto loans, and other consumer credit products.',
    poolType: 'CONSUMER' as PoolType,
    poolSize: 250000,
    minimumStake: 500,
    managementFeeRate: 1.5,
    performanceFeeRate: 15.0,
    baseInterestRate: 12.0,
    riskPremiumMin: 4.0,
    riskPremiumMax: 8.0,
    minCreditScore: 600,
    maxLTV: 0.85,
    allowedIndustries: ['consumer', 'personal'],
    isFeatured: false,
  },
];

// StakingPool ABI (minimal for createPool)
const stakingPoolAbi = [
  {
    type: 'function',
    name: 'createPool',
    inputs: [
      { name: '_poolId', type: 'bytes32' },
      { name: '_name', type: 'string' },
      { name: '_minimumStake', type: 'uint256' },
      { name: '_feeRate', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getPool',
    inputs: [{ name: '_poolId', type: 'bytes32' }],
    outputs: [
      { name: 'name', type: 'string' },
      { name: 'minimumStake', type: 'uint256' },
      { name: 'totalStaked', type: 'uint256' },
      { name: 'totalShares', type: 'uint256' },
      { name: 'feeRate', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
    stateMutability: 'view',
  },
] as const;

function hashPoolId(poolId: string): `0x${string}` {
  return keccak256(toBytes(poolId));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('');
  console.log('===========================================');
  console.log('  Locale Lending - Seed & Deploy Pools');
  console.log('===========================================');
  console.log('');

  if (dryRun) {
    console.log('[DRY RUN] No actual changes will be made.\n');
  }

  // Check environment
  const adminPrivateKey = process.env.POOL_ADMIN_PRIVATE_KEY;
  const stakingPoolAddress = process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS as `0x${string}`;
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';

  if (!adminPrivateKey) {
    console.error('Error: POOL_ADMIN_PRIVATE_KEY not set');
    process.exit(1);
  }

  if (!stakingPoolAddress) {
    console.error('Error: NEXT_PUBLIC_STAKING_POOL_ADDRESS not set');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log(`  RPC URL: ${rpcUrl}`);
  console.log(`  StakingPool: ${stakingPoolAddress}`);
  console.log(`  Chain: Arbitrum Sepolia (421614)`);
  console.log('');

  // Set up viem clients
  const chain = arbitrumSepolia;
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const account = privateKeyToAccount(adminPrivateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  console.log(`  Admin Address: ${account.address}`);
  console.log('');

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const poolData of SAMPLE_POOLS) {
    console.log(`\n--- Processing: ${poolData.name} ---`);

    try {
      // Check if pool already exists in database
      const existingPool = await prisma.loanPool.findUnique({
        where: { slug: poolData.slug },
      });

      if (existingPool) {
        if (existingPool.isOnChain) {
          console.log(`  [SKIP] Pool already exists and is deployed on-chain`);
          skipCount++;
          continue;
        }
        console.log(`  [INFO] Pool exists in DB but not on-chain. Re-deploying...`);
      }

      // Compute contract pool ID
      const contractPoolId = hashPoolId(poolData.slug);
      console.log(`  Contract Pool ID: ${contractPoolId}`);

      // Check if pool exists on contract
      let poolExistsOnChain = false;
      try {
        const onChainPool = await publicClient.readContract({
          address: stakingPoolAddress,
          abi: stakingPoolAbi,
          functionName: 'getPool',
          args: [contractPoolId],
        });
        if (onChainPool && onChainPool[0]) {
          poolExistsOnChain = true;
          console.log(`  [INFO] Pool already exists on smart contract`);
        }
      } catch {
        // Pool doesn't exist on chain, which is fine
      }

      if (dryRun) {
        console.log(`  [DRY RUN] Would create pool in DB and ${poolExistsOnChain ? 'sync' : 'deploy to'} blockchain`);
        successCount++;
        continue;
      }

      // Create or update pool in database
      let pool;
      if (existingPool) {
        pool = await prisma.loanPool.update({
          where: { id: existingPool.id },
          data: {
            contractPoolId: poolExistsOnChain ? contractPoolId : null,
            isOnChain: poolExistsOnChain,
            status: poolExistsOnChain ? 'ACTIVE' : 'DRAFT',
          },
        });
      } else {
        pool = await prisma.loanPool.create({
          data: {
            ...poolData,
            status: 'DRAFT',
            totalStaked: 0,
            totalInvestors: 0,
            availableLiquidity: poolData.poolSize,
            annualizedReturn: poolData.baseInterestRate + (poolData.riskPremiumMin + poolData.riskPremiumMax) / 2,
          },
        });
        console.log(`  [DB] Created pool with ID: ${pool.id}`);
      }

      // Deploy to blockchain if not already there
      if (!poolExistsOnChain) {
        console.log(`  [CHAIN] Deploying to smart contract...`);

        const minimumStakeWei = parseUnits(poolData.minimumStake.toString(), 6);
        const feeRateBasisPoints = BigInt(Math.round(poolData.managementFeeRate * 100));

        const txHash = await walletClient.writeContract({
          address: stakingPoolAddress,
          abi: stakingPoolAbi,
          functionName: 'createPool',
          args: [contractPoolId, poolData.name, minimumStakeWei, feeRateBasisPoints],
        });

        console.log(`  [CHAIN] Transaction: ${txHash}`);

        // Wait for confirmation
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          confirmations: 1,
        });

        if (receipt.status !== 'success') {
          throw new Error('Transaction failed');
        }

        console.log(`  [CHAIN] Confirmed in block ${receipt.blockNumber}`);

        // Update database with deployment info
        await prisma.loanPool.update({
          where: { id: pool.id },
          data: {
            contractPoolId,
            deployTxHash: txHash,
            deployedAtBlock: Number(receipt.blockNumber),
            isOnChain: true,
            status: 'ACTIVE',
            contractAddress: stakingPoolAddress,
          },
        });

        console.log(`  [DB] Updated pool status to ACTIVE`);
      } else {
        // Just update DB to sync with on-chain state
        await prisma.loanPool.update({
          where: { id: pool.id },
          data: {
            contractPoolId,
            isOnChain: true,
            status: 'ACTIVE',
            contractAddress: stakingPoolAddress,
          },
        });
        console.log(`  [DB] Synced pool with on-chain data`);
      }

      console.log(`  [SUCCESS] Pool ready!`);
      successCount++;
    } catch (error) {
      console.error(`  [ERROR] ${error instanceof Error ? error.message : 'Unknown error'}`);
      errorCount++;
    }
  }

  console.log('\n===========================================');
  console.log('  Summary');
  console.log('===========================================');
  console.log(`  Success: ${successCount}`);
  console.log(`  Skipped: ${skipCount}`);
  console.log(`  Errors:  ${errorCount}`);
  console.log('');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
