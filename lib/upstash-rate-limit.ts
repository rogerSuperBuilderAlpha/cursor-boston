/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { checkRateLimit } from "@/lib/rate-limit";

// Module-level singletons — safe in serverless (one instance per cold start)
let redis: Redis | null = null;
const limiterCache = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

function getLimiter(client: Redis, windowMs: number, maxRequests: number): Ratelimit {
  const cacheKey = `${windowMs}:${maxRequests}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) return cached;
  const limiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.fixedWindow(maxRequests, `${windowMs}ms`),
    prefix: "rl",
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
}

export interface UpstashRateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Distributed rate limiter backed by Upstash Redis.
 *
 * When UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set (e.g. local
 * development), it transparently falls back to the in-memory checkRateLimit so
 * contributors never need an Upstash account to run the project locally.
 */
export async function checkUpstashRateLimit(
  identifier: string,
  options: { windowMs: number; maxRequests: number }
): Promise<UpstashRateLimitResult> {
  const client = getRedis();

  // No Redis configured — use in-memory fallback (local dev / CI)
  if (!client) {
    return checkRateLimit(identifier, options);
  }

  const limiter = getLimiter(client, options.windowMs, options.maxRequests);
  const { success, remaining, reset } = await limiter.limit(identifier);
  const now = Date.now();
  return {
    success,
    remaining,
    resetTime: reset,
    retryAfter: success ? undefined : Math.ceil((reset - now) / 1000),
  };
}
