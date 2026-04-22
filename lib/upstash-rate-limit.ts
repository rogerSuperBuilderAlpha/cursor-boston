/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Distributed Rate Limiting Utility
 *
 * Wraps the in-memory rate limiter with an Upstash Redis-backed layer.
 * Falls back to the in-memory implementation when Redis credentials are absent.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { checkRateLimit } from "@/lib/rate-limit";

export interface UpstashRateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

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

function getLimiter(
  client: Redis,
  windowMs: number,
  maxRequests: number
): Ratelimit {
  const key = `${windowMs}:${maxRequests}`;
  const cached = limiterCache.get(key);
  if (cached) return cached;

  const limiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.fixedWindow(maxRequests, `${windowMs}ms`),
    prefix: "rl",
  });

  limiterCache.set(key, limiter);
  return limiter;
}

export async function checkUpstashRateLimit(
  identifier: string,
  options: { windowMs: number; maxRequests: number }
): Promise<UpstashRateLimitResult> {
  const { windowMs, maxRequests } = options;

  const client = getRedis();
  if (!client) {
    return checkRateLimit(identifier, options);
  }

  try {
    const limiter = getLimiter(client, windowMs, maxRequests);
    const { success, remaining, reset } = await limiter.limit(identifier);

    return {
      success,
      remaining,
      resetTime: reset,
      retryAfter: success ? undefined : Math.ceil((reset - Date.now()) / 1000),
    };

  } catch (error) {
    // Redis transient failure — degrade to per-instance in-memory limits
    // rather than 500ing the request.
    return checkRateLimit(identifier, options);
  }

}
