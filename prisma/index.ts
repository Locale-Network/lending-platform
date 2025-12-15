import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Use direct connection for pg Pool (pooler has auth issues with pg library)
// Falls back to POSTGRES_URL if NON_POOLING not set
const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});

const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

export default prisma;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
