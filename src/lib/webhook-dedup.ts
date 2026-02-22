/**
 * Webhook Deduplication Utility
 *
 * Prevents webhook replay attacks by tracking processed webhook IDs.
 * Uses PostgreSQL for distributed deduplication across serverless instances.
 *
 * Features:
 * - Prevents replay of old valid webhooks
 * - Distributed state via PostgreSQL (INSERT ... ON CONFLICT DO NOTHING)
 * - Automatic TTL cleanup
 * - Falls back to in-memory for development
 */

import prisma from './prisma';
import { logger } from './logger';

const log = logger.child({ module: 'webhook-dedup' });

// In-memory fallback for development
const processedWebhooks = new Map<string, number>();
const DEDUP_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Probabilistic cleanup counter
let cleanupCounter = 0;
const CLEANUP_INTERVAL = 100; // Run cleanup every ~100 operations

/**
 * Periodically clean up expired webhook dedup entries
 */
async function maybeCleanupExpired(): Promise<void> {
  cleanupCounter++;
  if (cleanupCounter % CLEANUP_INTERVAL !== 0) return;

  try {
    const deleted = await prisma.webhookDedup.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (deleted.count > 0) {
      log.info({ count: deleted.count }, 'Cleaned up expired webhook dedup entries');
    }
  } catch (error) {
    log.error({ err: error }, 'Failed to cleanup expired webhook dedup entries');
  }
}

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

  try {
    const entry = await prisma.webhookDedup.findUnique({
      where: { key },
    });

    if (entry && entry.expiresAt > new Date()) {
      return true;
    }

    return false;
  } catch (error) {
    log.error({ err: error }, 'Database error in isWebhookProcessed');
    return checkInMemory(key);
  }
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

  try {
    await prisma.webhookDedup.upsert({
      where: { key },
      create: {
        key,
        expiresAt: new Date(now + ttlSeconds * 1000),
      },
      update: {
        processedAt: new Date(),
        expiresAt: new Date(now + ttlSeconds * 1000),
      },
    });
  } catch (error) {
    log.error({ err: error }, 'Database error in markWebhookProcessed');
    markInMemory(key, now);
  }
}

/**
 * Check and mark in a single atomic operation
 * Returns true if this is a NEW webhook that should be processed
 *
 * SECURITY: Uses PostgreSQL INSERT ... ON CONFLICT DO NOTHING for atomic check-and-mark.
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

  try {
    const expiresAt = new Date(now + ttlSeconds * 1000);

    // Atomic INSERT ... ON CONFLICT DO NOTHING
    // If key doesn't exist: inserts and returns the row (isNew: true)
    // If key already exists: does nothing and returns empty result (isNew: false)
    const result = await prisma.$queryRaw<{ key: string }[]>`
      INSERT INTO webhook_dedup (key, processed_at, expires_at)
      VALUES (${key}, NOW(), ${expiresAt})
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    `;

    // Trigger periodic cleanup
    maybeCleanupExpired();

    if (result.length > 0) {
      return { isNew: true };
    } else {
      log.warn({ webhookId, provider }, 'Duplicate webhook detected - skipping');
      return { isNew: false };
    }
  } catch (error) {
    log.error({ err: error }, 'Database error in checkAndMarkWebhook — falling back to in-memory');

    if (process.env.NODE_ENV === 'production') {
      log.error('CRITICAL: Database query failed for webhook dedup in production');
    }

    return checkAndMarkInMemory(key, now);
  }
}

/**
 * In-memory atomic check-and-mark (for development only)
 * NOTE: This is NOT safe for distributed/serverless - use PostgreSQL in production
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

  try {
    await prisma.webhookDedup.delete({ where: { key } }).catch(() => {
      // Key might not exist — that's fine
    });
  } catch (error) {
    log.error({ err: error }, 'Database error in clearWebhookProcessed');
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
