import { PrismaClient } from '@prisma/client';

/**
 * Database Connection Configuration
 *
 * Uses Prisma's native connection management which handles PgBouncer
 * (Supabase pooler) correctly — manages prepared statements, connection
 * lifecycle, and transaction mode pooling internally.
 *
 * Connection URLs are configured in schema.prisma:
 * - url: POSTGRES_URL (pooler at port 6543, transaction mode)
 * - directUrl: POSTGRES_URL_NON_POOLING (direct at port 5432, for migrations)
 */

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

export default prisma;

// Reuse prisma instance in development to prevent connection exhaustion
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
