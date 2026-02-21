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
 *
 * IMPORTANT: Supabase pooler (port 6543) uses PgBouncer in transaction mode.
 * Prisma MUST have ?pgbouncer=true to disable prepared statements, otherwise
 * concurrent requests cause "prepared statement already exists" errors.
 */

function ensurePgBouncerFlag(url: string | undefined): string | undefined {
  if (!url) return url;
  if (url.includes('pgbouncer=true')) return url;
  // Auto-add pgbouncer flag for Supabase pooler connections (port 6543)
  if (url.includes('pooler.supabase.com')) {
    return url + (url.includes('?') ? '&' : '?') + 'pgbouncer=true';
  }
  return url;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasourceUrl: ensurePgBouncerFlag(process.env.POSTGRES_URL),
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

export default prisma;

// Reuse prisma instance in development to prevent connection exhaustion
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
