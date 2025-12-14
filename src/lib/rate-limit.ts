/**
 * Rate Limiting Utility
 *
 * Uses Upstash Redis for serverless rate limiting.
 * Falls back to in-memory rate limiting if Redis is not configured.
 *
 * Environment Variables Required:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 */

import { headers } from 'next/headers';

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

  /** General API endpoints: 100 requests per minute */
  api: { limit: 100, windowSeconds: 60 },

  /** Expensive operations (stake/unstake): 10 per hour */
  expensive: { limit: 10, windowSeconds: 3600 },

  /** Webhook endpoints: 50 per minute */
  webhook: { limit: 50, windowSeconds: 60 },

  /** CRON endpoints: 5 per minute (should only be called by Vercel) */
  cron: { limit: 5, windowSeconds: 60 },
} as const;

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
 * Check rate limit using Upstash Redis
 */
async function checkUpstashRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Skip rate limiting in development for easier testing
  if (process.env.NODE_ENV === 'development') {
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      reset: Date.now() + config.windowSeconds * 1000,
    };
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('Upstash Redis not configured, using in-memory fallback');
    return checkInMemoryRateLimit(identifier, config);
  }

  const key = `ratelimit:${identifier}:${config.limit}:${config.windowSeconds}`;
  const now = Date.now();
  const windowStart = now - config.windowSeconds * 1000;

  try {
    // Use sliding window algorithm with sorted sets
    const pipeline = [
      // Remove old entries outside the window
      ['ZREMRANGEBYSCORE', key, '0', windowStart.toString()],
      // Count current entries in window
      ['ZCARD', key],
      // Add current request
      ['ZADD', key, now.toString(), `${now}:${Math.random()}`],
      // Set expiry on the key
      ['EXPIRE', key, (config.windowSeconds + 1).toString()],
    ];

    const response = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pipeline),
    });

    if (!response.ok) {
      console.error('Upstash rate limit check failed:', await response.text());
      return checkInMemoryRateLimit(identifier, config);
    }

    const results = await response.json();
    const currentCount = results[1].result as number;

    if (currentCount >= config.limit) {
      return {
        success: false,
        limit: config.limit,
        remaining: 0,
        reset: now + config.windowSeconds * 1000,
      };
    }

    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - currentCount - 1,
      reset: now + config.windowSeconds * 1000,
    };
  } catch (error) {
    console.error('Upstash rate limit error:', error);
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

  return checkUpstashRateLimit(identifier, config);
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
 */
export function validateCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}
