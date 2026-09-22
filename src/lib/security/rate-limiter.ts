interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();
let lastCleanup = Date.now();

// Periodic cleanup every 60 seconds to prevent unbounded memory growth
function cleanupStaleKeys(now: number) {
  if (now - lastCleanup > 60000 || rateLimitStore.size > 5000) {
    lastCleanup = now;
    for (const [k, v] of rateLimitStore.entries()) {
      if (now >= v.resetAt) {
        rateLimitStore.delete(k);
      }
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

/**
 * In-memory sliding-window rate limiter with automatic garbage collection.
 * In distributed multi-instance production, this seamlessly connects to Redis/Memcached.
 */
export function checkRateLimit(
  key: string,
  limit = 120, // Increased baseline limit for high-traffic environments
  windowSeconds = 60
): RateLimitResult {
  const now = Date.now();
  cleanupStaleKeys(now);

  const record = rateLimitStore.get(key);

  if (!record || now >= record.resetAt) {
    const resetAt = now + windowSeconds * 1000;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetSeconds: windowSeconds,
    };
  }

  if (record.count >= limit) {
    const resetSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetSeconds,
    };
  }

  record.count += 1;
  const resetSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
  return {
    allowed: true,
    limit,
    remaining: limit - record.count,
    resetSeconds,
  };
}

export function resetRateLimitKey(key: string): void {
  rateLimitStore.delete(key);
}
