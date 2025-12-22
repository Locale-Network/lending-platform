/**
 * Database Migration Script: Encrypt Existing Plaid Access Tokens
 *
 * This script encrypts any existing unencrypted Plaid access tokens in the database.
 * It's designed to be idempotent - running it multiple times is safe.
 *
 * IMPORTANT:
 * 1. Set DATABASE_ENCRYPTION_KEY environment variable before running
 * 2. Backup your database before running this migration
 * 3. Test in staging/development before production
 *
 * Usage:
 *   npx tsx scripts/encrypt-existing-tokens.ts
 *   # or with --dry-run to preview changes
 *   npx tsx scripts/encrypt-existing-tokens.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';
import { encryptField, isEncrypted } from '../src/lib/encryption';

const prisma = new PrismaClient();

interface MigrationResult {
  tokensProcessed: number;
  tokensEncrypted: number;
  tokensAlreadyEncrypted: number;
  tokensFailed: number;
  errors: Array<{ id: number | string; error: string }>;
}

async function migrateTokens(dryRun: boolean): Promise<MigrationResult> {
  const result: MigrationResult = {
    tokensProcessed: 0,
    tokensEncrypted: 0,
    tokensAlreadyEncrypted: 0,
    tokensFailed: 0,
    errors: [],
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Plaid Access Token Encryption Migration`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Check encryption key is set
  if (!process.env.DATABASE_ENCRYPTION_KEY) {
    console.error('ERROR: DATABASE_ENCRYPTION_KEY environment variable is not set.');
    console.error('Generate one with: openssl rand -hex 32');
    process.exit(1);
  }

  // 1. Migrate PlaidItemAccessToken table
  console.log('Processing PlaidItemAccessToken table...');

  const plaidTokens = await prisma.plaidItemAccessToken.findMany({
    select: {
      id: true,
      accessToken: true,
    },
  });

  console.log(`Found ${plaidTokens.length} tokens in plaid_item_access_tokens table`);

  for (const token of plaidTokens) {
    result.tokensProcessed++;

    if (isEncrypted(token.accessToken)) {
      result.tokensAlreadyEncrypted++;
      console.log(`  [SKIP] Token ID ${token.id} - already encrypted`);
      continue;
    }

    try {
      const encryptedToken = encryptField(token.accessToken);

      if (!dryRun) {
        await prisma.plaidItemAccessToken.update({
          where: { id: token.id },
          data: { accessToken: encryptedToken },
        });
      }

      result.tokensEncrypted++;
      console.log(`  [${dryRun ? 'WOULD ENCRYPT' : 'ENCRYPTED'}] Token ID ${token.id}`);
    } catch (error) {
      result.tokensFailed++;
      result.errors.push({
        id: token.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.error(`  [FAILED] Token ID ${token.id}: ${error}`);
    }
  }

  // 2. Migrate LoanApplication.plaidAccessToken field
  console.log('\nProcessing LoanApplication.plaidAccessToken field...');

  const loanApps = await prisma.loanApplication.findMany({
    where: {
      plaidAccessToken: {
        not: null,
      },
    },
    select: {
      id: true,
      plaidAccessToken: true,
    },
  });

  console.log(`Found ${loanApps.length} loan applications with Plaid tokens`);

  for (const loan of loanApps) {
    if (!loan.plaidAccessToken) continue;

    result.tokensProcessed++;

    if (isEncrypted(loan.plaidAccessToken)) {
      result.tokensAlreadyEncrypted++;
      console.log(`  [SKIP] Loan ${loan.id} - already encrypted`);
      continue;
    }

    try {
      const encryptedToken = encryptField(loan.plaidAccessToken);

      if (!dryRun) {
        await prisma.loanApplication.update({
          where: { id: loan.id },
          data: { plaidAccessToken: encryptedToken },
        });
      }

      result.tokensEncrypted++;
      console.log(`  [${dryRun ? 'WOULD ENCRYPT' : 'ENCRYPTED'}] Loan ${loan.id}`);
    } catch (error) {
      result.tokensFailed++;
      result.errors.push({
        id: loan.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.error(`  [FAILED] Loan ${loan.id}: ${error}`);
    }
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  try {
    const result = await migrateTokens(dryRun);

    console.log(`\n${'='.repeat(60)}`);
    console.log('Migration Summary');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total tokens processed:    ${result.tokensProcessed}`);
    console.log(`Newly encrypted:           ${result.tokensEncrypted}`);
    console.log(`Already encrypted (skip):  ${result.tokensAlreadyEncrypted}`);
    console.log(`Failed:                    ${result.tokensFailed}`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      for (const err of result.errors) {
        console.log(`  - ID ${err.id}: ${err.error}`);
      }
    }

    if (dryRun) {
      console.log('\n** DRY RUN COMPLETE - No changes were made **');
      console.log('Run without --dry-run to apply changes.');
    } else {
      console.log('\n** MIGRATION COMPLETE **');
    }

    process.exit(result.tokensFailed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
