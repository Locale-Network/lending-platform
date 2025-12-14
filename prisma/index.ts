import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';

const neonPool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

const pgPool = new PgPool({
  connectionString: process.env.POSTGRES_URL,
});

const adapter = process.env.DB_ADAPTER === 'neon' ? new PrismaNeon(neonPool) : new PrismaPg(pgPool);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

export default prisma;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
