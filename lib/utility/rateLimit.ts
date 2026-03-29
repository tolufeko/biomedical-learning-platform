// lib/ratelimit.ts
const requestCounts = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCounts.entries()) {
    if (now >= value.resetAt) requestCounts.delete(key);
  }
}, 5 * 60 * 1000);

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  secondsLeft?: number;
}

export function checkRateLimit(userId: string, key: string, options: RateLimitOptions): RateLimitResult {
  const mapKey = `${key}:${userId}`;
  const now = Date.now();
  const entry = requestCounts.get(mapKey);

  if (entry && now < entry.resetAt) {
    if (entry.count >= options.maxRequests) {
      return {
        allowed: false,
        secondsLeft: Math.ceil((entry.resetAt - now) / 1000),
      };
    }
    entry.count++;
  } else {
    requestCounts.set(mapKey, { count: 1, resetAt: now + options.windowMs });
  }

  return { allowed: true };
}