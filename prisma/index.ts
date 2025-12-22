import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, PoolConfig } from 'pg';

/**
 * Database Connection Configuration
 *
 * Security measures:
 * - SSL/TLS required in production (rejectUnauthorized: true for CA-signed certs)
 * - Connection timeout to prevent hanging connections
 * - Statement timeout to prevent long-running queries
 * - Connection pooling via pg Pool
 */

// Use direct connection for pg Pool (pooler has auth issues with pg library)
// Falls back to POSTGRES_URL if NON_POOLING not set
const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

// Validate connection string exists
if (!connectionString) {
  throw new Error(
    'Database connection string not configured. Set POSTGRES_URL or POSTGRES_URL_NON_POOLING.'
  );
}

// Pool configuration with security settings
const poolConfig: PoolConfig = {
  connectionString,
  // SSL configuration
  ssl:
    process.env.NODE_ENV === 'production'
      ? {
          // For Supabase/managed DBs with proper CA certs, use rejectUnauthorized: true
          // For self-signed certs, you may need rejectUnauthorized: false (less secure)
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        }
      : false,
  // Connection limits
  max: 10, // Maximum connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Fail if connection takes >10s
  // Statement timeout to prevent long-running queries (5 minutes max)
  statement_timeout: 300000,
};

const pool = new Pool(poolConfig);

// Log pool errors for monitoring
pool.on('error', (err) => {
  console.error('[Database Pool] Unexpected error on idle client:', err);
});

const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

export default prisma;

// Reuse prisma instance in development to prevent connection exhaustion
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
