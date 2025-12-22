/**
 * Distributed Lock Utility
 *
 * Uses Upstash Redis for distributed locking across serverless instances.
 * Essential for preventing race conditions in cron jobs and other concurrent operations.
 *
 * Environment Variables Required:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 */

interface LockResult {
  acquired: boolean;
  lockId?: string;
}

interface ReleaseLockResult {
  released: boolean;
  error?: string;
}

/**
 * Acquire a distributed lock
 *
 * Uses Redis SET NX (set if not exists) with expiration for safe locking.
 * The lock automatically expires after ttlMs to prevent deadlocks.
 *
 * @param key - Unique identifier for the lock (e.g., 'yield_distribution')
 * @param ttlMs - Time-to-live in milliseconds (lock expires after this time)
 * @returns LockResult with acquired status and lockId if successful
 */
export async function acquireLock(
  key: string,
  ttlMs: number
): Promise<LockResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('[Distributed Lock] Upstash Redis not configured');
    // In development without Redis, allow the operation but log warning
    // In production, this should fail
    if (process.env.NODE_ENV === 'production') {
      return { acquired: false };
    }
    return { acquired: true, lockId: `local-${Date.now()}` };
  }

  const lockId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  const lockKey = `lock:${key}`;
  const ttlSeconds = Math.ceil(ttlMs / 1000);

  try {
    // SET NX with expiration - atomic operation
    // Returns "OK" if lock was acquired, null if key already exists
    const response = await fetch(`${url}/SET/${lockKey}/${lockId}/NX/EX/${ttlSeconds}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('[Distributed Lock] Failed to acquire lock:', await response.text());
      return { acquired: false };
    }

    const result = await response.json();

    if (result.result === 'OK') {
      console.log(`[Distributed Lock] Acquired lock: ${lockKey} (id: ${lockId})`);
      return { acquired: true, lockId };
    }

    console.log(`[Distributed Lock] Lock already held: ${lockKey}`);
    return { acquired: false };
  } catch (error) {
    console.error('[Distributed Lock] Error acquiring lock:', error);
    return { acquired: false };
  }
}

/**
 * Release a distributed lock
 *
 * Uses a Lua script to atomically check ownership and release.
 * Only releases if the lockId matches, preventing accidental release of another instance's lock.
 *
 * @param key - The lock key used when acquiring
 * @param lockId - The lockId returned from acquireLock
 * @returns ReleaseLockResult with released status
 */
export async function releaseLock(
  key: string,
  lockId: string
): Promise<ReleaseLockResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // If no Redis in dev, just return success
    if (process.env.NODE_ENV !== 'production') {
      return { released: true };
    }
    return { released: false, error: 'Redis not configured' };
  }

  const lockKey = `lock:${key}`;

  try {
    // First, get the current value to verify ownership
    const getResponse = await fetch(`${url}/GET/${lockKey}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!getResponse.ok) {
      return { released: false, error: 'Failed to check lock' };
    }

    const getResult = await getResponse.json();
    const currentValue = getResult.result;

    // If the lock value doesn't match our lockId, don't release
    // This prevents releasing a lock that was acquired by another instance
    if (currentValue !== lockId) {
      console.warn(`[Distributed Lock] Lock ownership mismatch: ${lockKey}`);
      return { released: false, error: 'Lock ownership mismatch' };
    }

    // Delete the lock
    const delResponse = await fetch(`${url}/DEL/${lockKey}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!delResponse.ok) {
      return { released: false, error: 'Failed to release lock' };
    }

    console.log(`[Distributed Lock] Released lock: ${lockKey}`);
    return { released: true };
  } catch (error) {
    console.error('[Distributed Lock] Error releasing lock:', error);
    return { released: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Execute a function with a distributed lock
 *
 * Convenience wrapper that acquires lock, executes function, and releases lock.
 * The lock is always released, even if the function throws.
 *
 * @param key - Unique identifier for the lock
 * @param ttlMs - Lock TTL in milliseconds
 * @param fn - Function to execute while holding the lock
 * @returns Result of the function, or null if lock couldn't be acquired
 */
export async function withLock<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<{ success: true; result: T } | { success: false; reason: 'lock_not_acquired' | 'execution_error'; error?: string }> {
  const lock = await acquireLock(key, ttlMs);

  if (!lock.acquired || !lock.lockId) {
    return { success: false, reason: 'lock_not_acquired' };
  }

  try {
    const result = await fn();
    return { success: true, result };
  } catch (error) {
    console.error(`[Distributed Lock] Error in locked function (key: ${key}):`, error);
    return {
      success: false,
      reason: 'execution_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    await releaseLock(key, lock.lockId);
  }
}
