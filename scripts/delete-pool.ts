#!/usr/bin/env npx tsx
/**
 * Delete Pool Script
 *
 * Deletes a pool and all associated records from the database.
 *
 * Usage:
 *   npx tsx scripts/delete-pool.ts <pool-id>
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local'), override: true });

const prisma = new PrismaClient();

async function main() {
  const poolId = process.argv[2];

  if (!poolId) {
    console.error('Usage: npx tsx scripts/delete-pool.ts <pool-id>');
    process.exit(1);
  }

  console.log(`Looking up pool: ${poolId}`);

  // First, check if the pool exists
  const pool = await prisma.loanPool.findUnique({
    where: { id: poolId },
    include: {
      stakes: true,
      loans: true,
    },
  });

  if (!pool) {
    console.error(`Pool not found: ${poolId}`);
    process.exit(1);
  }

  console.log(`Found pool: "${pool.name}" (${pool.slug})`);
  console.log(`  - Status: ${pool.status}`);
  console.log(`  - Stakes: ${pool.stakes.length}`);
  console.log(`  - Loans: ${pool.loans.length}`);
  console.log(`  - Total Staked: $${pool.totalStaked.toLocaleString()}`);

  // Delete stake transactions first (if the table exists)
  try {
    const deletedTransactions = await prisma.$executeRaw`
      DELETE FROM stake_transactions WHERE pool_id = ${poolId}
    `;
    console.log(`Deleted ${deletedTransactions} stake transactions`);
  } catch (e) {
    console.log('No stake_transactions table or no records to delete');
  }

  // Delete the pool (cascades to stakes and loans)
  const deletedPool = await prisma.loanPool.delete({
    where: { id: poolId },
  });

  console.log(`\nSuccessfully deleted pool: "${deletedPool.name}"`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
