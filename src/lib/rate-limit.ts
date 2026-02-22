/**
 * Rate Limiting Utility
 *
 * Uses PostgreSQL for serverless rate limiting.
 * Falls back to in-memory rate limiting if database is not available.
 */

import { headers } from 'next/headers';
import { timingSafeEqual } from 'crypto';
import prisma from './prisma';
import { logger } from './logger';

const log = logger.child({ module: 'rate-limit' });

// In-memory fallback for development (not for production!)
const inMemoryStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  /** Maximum number of requests allowed */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

// Predefined rate limit configurations
export const rateLimits = {
  /** Auth endpoints (login/signup): 5 requests per minute */
  auth: { limit: 5, windowSeconds: 60 },

  /** Auth sync endpoint: 100 requests per minute (very permissive for dev/React strict mode) */
  authSync: { limit: 100, windowSeconds: 60 },

  /** Auth sync conflict tracking: 20 conflicts per 10 minutes before forcing re-auth */
  authSyncConflict: { limit: 20, windowSeconds: 600 },

  /** General API endpoints: 100 requests per minute */
  api: { limit: 100, windowSeconds: 60 },

  /** Expensive operations (stake/unstake): 10 per hour */
  expensive: { limit: 10, windowSeconds: 3600 },

  /** Webhook endpoints: 50 per minute */
  webhook: { limit: 50, windowSeconds: 60 },

  /** CRON endpoints: 5 per minute (should only be called by Vercel) */
  cron: { limit: 5, windowSeconds: 60 },
} as const;

// Probabilistic cleanup counter
let cleanupCounter = 0;
const CLEANUP_INTERVAL = 50;

/**
 * Periodically clean up expired rate limit entries
 */
async function maybeCleanupExpired(): Promise<void> {
  cleanupCounter++;
  if (cleanupCounter % CLEANUP_INTERVAL !== 0) return;

  try {
    await prisma.rateLimitEntry.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  } catch {
    // Silently ignore cleanup errors
  }
}

/**
 * Get client IP address from request headers
 */
export async function getClientIp(): Promise<string> {
  const headersList = await headers();
  const forwardedFor = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');

  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

/**
 * Check rate limit using in-memory store (development fallback)
 */
function checkInMemoryRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = `${identifier}:${config.limit}:${config.windowSeconds}`;
  const entry = inMemoryStore.get(key);

  if (!entry || now > entry.resetTime) {
    // Create new entry
    const resetTime = now + config.windowSeconds * 1000;
    inMemoryStore.set(key, { count: 1, resetTime });
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      reset: resetTime,
    };
  }

  if (entry.count >= config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      reset: entry.resetTime,
    };
  }

  entry.count++;
  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    reset: entry.resetTime,
  };
}

/**
 * Check rate limit using PostgreSQL
 *
 * Uses an atomic UPSERT with window-based counter:
 * - If no entry or window expired: resets counter to 1
 * - If within window: increments counter
 * - Returns current count for limit comparison
 *
 * SECURITY NOTE: Rate limiting can ONLY be disabled in development mode.
 * Production ALWAYS enforces rate limits regardless of environment variables.
 */
async function checkPostgresRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // SECURITY: Rate limiting bypass is ONLY allowed in development
  if (process.env.DISABLE_RATE_LIMIT === 'true') {
    if (process.env.NODE_ENV === 'production') {
      log.error('SECURITY: DISABLE_RATE_LIMIT attempted in production - BLOCKED');
    } else if (process.env.NODE_ENV === 'development') {
      log.warn('DEV ONLY: Rate limiting disabled for development');
      return {
        success: true,
        limit: config.limit,
        remaining: config.limit - 1,
        reset: Date.now() + config.windowSeconds * 1000,
      };
    }
  }

  const key = `ratelimit:${identifier}:${config.limit}:${config.windowSeconds}`;
  const now = new Date();
  const windowEnd = new Date(now.getTime() + config.windowSeconds * 1000);

  try {
    // Atomic upsert: insert new entry or increment count within window
    // If window has expired (expires_at <= now), resets to count=1 with new window
    // If window is still active, increments count
    const result = await prisma.$queryRaw<{ count: number; expires_at: Date }[]>`
      INSERT INTO rate_limit_entries (key, count, window_start, expires_at)
      VALUES (${key}, 1, ${now}, ${windowEnd})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limit_entries.expires_at <= ${now} THEN 1
          ELSE rate_limit_entries.count + 1
        END,
        window_start = CASE
          WHEN rate_limit_entries.expires_at <= ${now} THEN ${now}
          ELSE rate_limit_entries.window_start
        END,
        expires_at = CASE
          WHEN rate_limit_entries.expires_at <= ${now} THEN ${windowEnd}
          ELSE rate_limit_entries.expires_at
        END
      RETURNING count, expires_at
    `;

    maybeCleanupExpired();

    if (result.length === 0) {
      return checkInMemoryRateLimit(identifier, config);
    }

    const { count, expires_at } = result[0];
    const resetTime = expires_at.getTime();

    if (count > config.limit) {
      return {
        success: false,
        limit: config.limit,
        remaining: 0,
        reset: resetTime,
      };
    }

    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - count,
      reset: resetTime,
    };
  } catch (error) {
    log.error({ err: error }, 'Database rate limit error — falling back to in-memory');
    if (process.env.NODE_ENV === 'production') {
      log.error('CRITICAL: Database query failed for rate limiting in production');
    }
    return checkInMemoryRateLimit(identifier, config);
  }
}

/**
 * Check rate limit for an identifier
 *
 * @param identifier - Unique identifier (usually IP address or user ID)
 * @param configKey - Key from rateLimits object or custom config
 * @returns Rate limit result
 *
 * @example
 * ```ts
 * const ip = getClientIp();
 * const result = await checkRateLimit(ip, 'expensive');
 *
 * if (!result.success) {
 *   return NextResponse.json(
 *     { error: 'Too many requests' },
 *     {
 *       status: 429,
 *       headers: {
 *         'X-RateLimit-Limit': String(result.limit),
 *         'X-RateLimit-Remaining': String(result.remaining),
 *         'X-RateLimit-Reset': String(result.reset),
 *       },
 *     }
 *   );
 * }
 * ```
 */
export async function checkRateLimit(
  identifier: string,
  configKey: keyof typeof rateLimits | RateLimitConfig
): Promise<RateLimitResult> {
  const config =
    typeof configKey === 'string' ? rateLimits[configKey] : configKey;

  return checkPostgresRateLimit(identifier, config);
}

/**
 * Create rate limit response headers
 */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
  };
}

/**
 * Validate CRON secret for protected CRON endpoints
 *
 * Supports two authentication methods:
 * 1. Bearer token with CRON_SECRET (for manual/external triggers)
 * 2. Vercel cron header (for Vercel-triggered crons)
 *
 * In production, at least one method must succeed.
 */
/** Timing-safe string comparison to prevent timing attacks on secrets */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function validateCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // CRON_SECRET is required in production
  if (!cronSecret) {
    log.error('CRON_SECRET not configured - rejecting request');
    return false;
  }

  const expectedToken = `Bearer ${cronSecret}`;

  // Check Bearer token
  const authHeader = request.headers.get('authorization');
  if (authHeader && safeCompare(authHeader, expectedToken)) {
    return true;
  }

  // Check Vercel cron header (Vercel sets this for scheduled crons)
  // See: https://vercel.com/docs/cron-jobs#securing-cron-jobs
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  if (vercelCronHeader === '1') {
    // Additionally verify the authorization header matches when both are present
    // This prevents someone from just setting x-vercel-cron header
    if (!authHeader) {
      log.warn('Vercel cron header present but no auth header - rejecting');
      return false;
    }
    if (safeCompare(authHeader, expectedToken)) {
      return true;
    }
  }

  log.warn('Invalid or missing cron authentication');
  return false;
}
