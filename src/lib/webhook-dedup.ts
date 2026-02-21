/**
 * Webhook Deduplication Utility
 *
 * Prevents webhook replay attacks by tracking processed webhook IDs.
 * Uses Upstash Redis for distributed deduplication across serverless instances.
 *
 * Features:
 * - Prevents replay of old valid webhooks
 * - Distributed state via Redis
 * - Automatic TTL cleanup
 * - Falls back to in-memory for development
 */

import { logger } from './logger';

const log = logger.child({ module: 'webhook-dedup' });

// In-memory fallback for development
const processedWebhooks = new Map<string, number>();
const DEDUP_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if a webhook has already been processed (idempotency check)
 *
 * @param webhookId - Unique identifier for the webhook (e.g., payment ID, event ID)
 * @param provider - Webhook provider name (e.g., 'circle', 'plaid')
 * @returns true if already processed (should skip), false if new (should process)
 */
export async function isWebhookProcessed(
  webhookId: string,
  provider: string
): Promise<boolean> {
  const key = `webhook:${provider}:${webhookId}`;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Use Redis if available
  if (url && token) {
    try {
      const response = await fetch(`${url}/get/${key}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        log.error({ status: response.status }, 'Redis GET failed');
        return checkInMemory(key);
      }

      const result = await response.json();
      return result.result !== null;
    } catch (error) {
      log.error({ err: error }, 'Redis connection error');
      return checkInMemory(key);
    }
  }

  // Fallback to in-memory
  return checkInMemory(key);
}

/**
 * Mark a webhook as processed
 *
 * @param webhookId - Unique identifier for the webhook
 * @param provider - Webhook provider name
 * @param ttlSeconds - How long to remember this webhook (default: 24 hours)
 */
export async function markWebhookProcessed(
  webhookId: string,
  provider: string,
  ttlSeconds: number = 86400
): Promise<void> {
  const key = `webhook:${provider}:${webhookId}`;
  const now = Date.now();

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Use Redis if available
  if (url && token) {
    try {
      const response = await fetch(`${url}/setex/${key}/${ttlSeconds}/${now}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        log.error({ status: response.status }, 'Redis SETEX failed');
        markInMemory(key, now);
      }
    } catch (error) {
      log.error({ err: error }, 'Redis connection error');
      markInMemory(key, now);
    }
    return;
  }

  // Fallback to in-memory
  markInMemory(key, now);
}

/**
 * Check and mark in a single atomic operation
 * Returns true if this is a NEW webhook that should be processed
 *
 * SECURITY: Uses Redis SETNX (set if not exists) for atomic check-and-mark.
 * This prevents double-processing where:
 * 1. Process A checks - not processed
 * 2. Process B checks - not processed
 * 3. Process A marks as processed
 * 4. Process B marks as processed
 * 5. BOTH process the webhook (double-spend!)
 */
export async function checkAndMarkWebhook(
  webhookId: string,
  provider: string,
  ttlSeconds: number = 86400
): Promise<{ isNew: boolean }> {
  const key = `webhook:${provider}:${webhookId}`;
  const now = Date.now();

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Use Redis if available - atomic SETNX operation
  if (url && token) {
    try {
      // SECURITY FIX: Use SET NX EX for atomic check-and-set
      // NX = only set if not exists
      // EX = set expiration
      // This is atomic - if the key exists, it returns null, otherwise sets and returns OK
      const response = await fetch(
        `${url}/SET/${encodeURIComponent(key)}/${now}/NX/EX/${ttlSeconds}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        log.error({ status: response.status }, 'Redis SET NX failed');
        // Fall back to in-memory (less safe but better than failing)
        return checkAndMarkInMemory(key, now);
      }

      const result = await response.json();

      // SET NX returns "OK" if the key was set (new webhook)
      // Returns null if the key already existed (duplicate)
      if (result.result === 'OK') {
        return { isNew: true };
      } else {
        log.warn({ webhookId, provider }, 'Duplicate webhook detected - skipping');
        return { isNew: false };
      }
    } catch (error) {
      log.error({ err: error }, 'Redis connection error in checkAndMarkWebhook');
      return checkAndMarkInMemory(key, now);
    }
  }

  // SECURITY: In production, log critical warning when Redis is not configured
  if (process.env.NODE_ENV === 'production') {
    log.error('CRITICAL: Redis not configured in production — webhook dedup using in-memory (NOT distributed)');
  }

  // Fallback to in-memory (not safe for distributed systems)
  return checkAndMarkInMemory(key, now);
}

/**
 * In-memory atomic check-and-mark (for development only)
 * NOTE: This is NOT safe for distributed/serverless - use Redis in production
 */
function checkAndMarkInMemory(key: string, timestamp: number): { isNew: boolean } {
  cleanupInMemory();

  if (processedWebhooks.has(key)) {
    log.warn({ key }, 'Duplicate webhook detected (in-memory) - skipping');
    return { isNew: false };
  }

  processedWebhooks.set(key, timestamp);
  return { isNew: true };
}

/**
 * Clear a previously marked webhook so it can be reprocessed.
 * Use when webhook processing fails after the atomic mark (e.g., on-chain tx fails)
 * to allow the payment provider to retry.
 */
export async function clearWebhookProcessed(
  webhookId: string,
  provider: string
): Promise<void> {
  const key = `webhook:${provider}:${webhookId}`;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      await fetch(`${url}/DEL/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      log.error({ err: error }, 'Redis DEL failed in clearWebhookProcessed');
    }
  }

  processedWebhooks.delete(key);
}

// In-memory helpers
function checkInMemory(key: string): boolean {
  cleanupInMemory();
  return processedWebhooks.has(key);
}

function markInMemory(key: string, timestamp: number): void {
  cleanupInMemory();
  processedWebhooks.set(key, timestamp);
}

function cleanupInMemory(): void {
  const now = Date.now();
  for (const [key, timestamp] of processedWebhooks) {
    if (now - timestamp > DEDUP_TTL_MS) {
      processedWebhooks.delete(key);
    }
  }
}
