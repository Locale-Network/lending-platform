import { NextResponse } from 'next/server';
import prisma from '@prisma/index';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'health' });

/**
 * Health Check Endpoint
 *
 * Used by load balancers, monitoring services, and deployment pipelines
 * to verify the application is running and can connect to dependencies.
 *
 * GET /api/health
 *
 * Returns:
 * - 200: Service is healthy
 * - 503: Service is unhealthy (database connection failed)
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        responseTime: `${responseTime}ms`,
        checks: {
          database: 'connected',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const responseTime = Date.now() - startTime;

    log.error({ err: error, responseTime }, 'Database connection failed');

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        responseTime: `${responseTime}ms`,
        checks: {
          database: 'disconnected',
        },
      },
      { status: 503 }
    );
  }
}
