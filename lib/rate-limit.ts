/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Rate Limiting Utility
 * 
 * Simple in-memory rate limiter for API routes.
 * For production, consider using Redis or a dedicated rate limiting service.
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};
const CLEANUP_INTERVAL_MS = 60_000; // Clean up every 60 seconds
const MAX_STORE_SIZE = 10_000; // Maximum entries before forced cleanup
let lastCleanupTime = Date.now();

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: Request) => string; // Custom key generator
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Generates response headers for in-memory rate limiting (no Firestore transaction reads).
 * 
 * @param {RateLimitResult} result - The result of the rate limit check containing remaining limits and reset times.
 * @param {number} maxRequests - The maximum number of requests allowed in the current window.
 * @returns {Record<string, string>} An object containing the rate limit HTTP headers.
 * 
 * @example
 * const result = checkRateLimit(ip, options);
 * const headers = buildMemoryRateLimitHeaders(result, options.maxRequests);
 * // returns { "X-RateLimit-Limit": "60", "X-RateLimit-Remaining": "59", ... }
 */
export function buildMemoryRateLimitHeaders(
  result: RateLimitResult,
  maxRequests: number
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(maxRequests),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetTime),
    "X-RateLimit-Source": "memory",
  };
  if (result.retryAfter) {
    headers["Retry-After"] = String(result.retryAfter);
  }
  return headers;
}

/**
 * Performs a rate limit check against the in-memory store.
 * 
 * @param {string} identifier - Unique identifier (e.g., IP address, user ID).
 * @param {RateLimitOptions} options - Rate limit configuration options.
 * @returns {RateLimitResult} The current rate limit status for the identifier.
 * 
 * @example
 * const status = checkRateLimit("192.168.1.1", { windowMs: 60000, maxRequests: 100 });
 * if (!status.success) {
 *   console.log(`Rate limited! Retry after ${status.retryAfter}s`);
 * }
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const key = identifier;
  const { windowMs, maxRequests } = options;

  // Clean up expired entries on a deterministic interval (every 60 seconds)
  if (now - lastCleanupTime > CLEANUP_INTERVAL_MS) {
    lastCleanupTime = now;
    cleanupExpiredEntries(now);
  }

  const entry = store[key];

  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired entry
    store[key] = {
      count: 1,
      resetTime: now + windowMs,
    };
    return {
      success: true,
      remaining: maxRequests - 1,
      resetTime: now + windowMs,
    };
  }

  // Increment first, then check (prevents race condition where concurrent
  // requests read the same count before either increments)
  entry.count++;

  if (entry.count > maxRequests) {
    // Rate limit exceeded — undo increment so count stays at max
    entry.count--;
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter,
    };
  }

  return {
    success: true,
    remaining: maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Get client identifier from request by extracting the IP address.
 * Checks proxy headers in priority order: x-forwarded-for, x-real-ip, cf-connecting-ip.
 * 
 * @param {Request} request - The incoming HTTP request.
 * @returns {string} The client IP address string, or "unknown" if not determinable.
 * 
 * @example
 * export async function GET(request: Request) {
 *   const ip = getClientIdentifier(request);
 *   return new Response(`Your IP is ${ip}`);
 * }
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from various headers (for proxies/load balancers)
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip"); // Cloudflare

  const ip = forwarded?.split(",")[0]?.trim() || realIp || cfConnectingIp || "unknown";
  return ip;
}

/**
 * Clean up expired entries from the store
 */
function cleanupExpiredEntries(now: number): void {
  const keys = Object.keys(store);
  for (const key of keys) {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  }
  // If still over max size after removing expired, remove oldest entries
  const remainingKeys = Object.keys(store);
  if (remainingKeys.length > MAX_STORE_SIZE) {
    const sorted = remainingKeys.sort((a, b) => store[a].resetTime - store[b].resetTime);
    const toRemove = sorted.slice(0, remainingKeys.length - MAX_STORE_SIZE);
    for (const key of toRemove) {
      delete store[key];
    }
  }
}

/**
 * Rate limit middleware for Next.js API routes.
 * Wraps a handler with rate limiting and adds X-RateLimit headers to all responses.
 * 
 * @param {RateLimitOptions} options - Rate limit configuration including window size and max requests.
 * @param {(request: Request) => Promise<Response>} handler - The API route handler to wrap.
 * @returns {(request: Request) => Promise<Response>} A new async handler function with rate limiting applied.
 * 
 * @example
 * // Example 1: Basic usage with a preset config
 * export const POST = withRateLimit(rateLimitConfigs.standard, async (req) => {
 *   return new Response("Success");
 * });
 * 
 * @example
 * // Example 2: Usage with custom configuration
 * export const GET = withRateLimit({ windowMs: 10000, maxRequests: 5 }, async (req) => {
 *   return Response.json({ data: "Hello World" });
 * });
 */
export function withRateLimit(
  options: RateLimitOptions,
  handler: (request: Request) => Promise<Response>
) {
  return async (request: Request): Promise<Response> => {
    const identifier = options.keyGenerator
      ? options.keyGenerator(request)
      : getClientIdentifier(request);

    const result = checkRateLimit(identifier, options);

    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: "Too many requests",
          message: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(result.retryAfter || 60),
            "X-RateLimit-Limit": String(options.maxRequests),
            "X-RateLimit-Remaining": String(result.remaining),
            "X-RateLimit-Reset": String(result.resetTime),
          },
        }
      );
    }

    // Add rate limit headers to response
    const response = await handler(request);
    const headers = new Headers(response.headers);
    headers.set("X-RateLimit-Limit", String(options.maxRequests));
    headers.set("X-RateLimit-Remaining", String(result.remaining));
    headers.set("X-RateLimit-Reset", String(result.resetTime));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

/**
 * Predefined rate limit configurations for common API route types.
 * Use these with withRateLimit() to apply consistent limits across the app.
 * @example
 * export const POST = withRateLimit(rateLimitConfigs.standard, handler);
 */
export const rateLimitConfigs = {
  /**
   * Strict rate limit for OAuth callbacks to prevent abuse and brute-forcing.
   */
  oauthCallback: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // 10 requests per 15 minutes
  },
  /**
   * Moderate rate limit for incoming webhooks.
   */
  webhook: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
  },
  /**
   * Standard rate limit for general, authenticated API routes.
   */
  standard: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  },
  /**
   * Lenient rate limit for general public endpoints.
   */
  public: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  },
  /**
   * Strict rate limit for hackathon mutations that change team or submission state.
   */
  hackathonMutation: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
  },
  /**
   * Standard rate limit for hackathon pool, invite, request, and team profile actions.
   */
  hackathonAction: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 requests per minute
  },
  /**
   * Limits for eligibility checks which are read-heavy but still authenticated.
   */
  hackathonEligibility: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
  },
  /**
   * Event signup rate limiting, used by GET/POST/DELETE on the same endpoint.
   */
  hackathonEventSignup: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 40, // 40 requests per minute
  },
  /**
   * Rate limiting for Hackathon Showcase AI scoring submissions.
   */
  hackathonShowcaseAiScore: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
  },
  /**
   * Rate limiting for Hackathon Showcase Judge scoring submissions.
   */
  hackathonShowcaseJudgeScore: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 40, // 40 requests per minute
  },
  /**
   * Rate limiting for unlocking Hackathon Showcase voting functionality.
   */
  hackathonShowcaseUnlock: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 requests per minute
  },
  /**
   * Strict rate limiting for brute-force prevention on Showcase unlock attempts.
   */
  hackathonShowcaseUnlockAttempts: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 15, // 15 attempts per 5 minutes
  },
  /**
   * Rate limiting for casting votes in the Hackathon Showcase.
   */
  hackathonShowcaseVote: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
  },
  /**
   * Rate limiting for fetching/updating Hackathon Showcase participant scores.
   */
  hackathonShowcaseParticipantScore: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 score updates per minute per IP
  },
  /**
   * Highly strict rate limiting for credit-related emails in the Hackathon Showcase.
   */
  hackathonShowcaseCreditEmail: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 emails per hour per IP
  },
};
