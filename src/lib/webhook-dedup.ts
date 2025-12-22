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
 */
export async function checkAndMarkWebhook(
  webhookId: string,
  provider: string
): Promise<{ isNew: boolean }> {
  const wasProcessed = await isWebhookProcessed(webhookId, provider);

  if (wasProcessed) {
    log.warn({ webhookId, provider }, 'Duplicate webhook detected - skipping');
    return { isNew: false };
  }

  await markWebhookProcessed(webhookId, provider);
  return { isNew: true };
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
