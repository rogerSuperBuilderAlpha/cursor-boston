/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Next.js Middleware Utilities
 * 
 * Wrappers for rate limiting, logging, and CSRF protection that work with Next.js API routes
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIdentifier } from "./rate-limit";
import { logger } from "./logger";

// Re-export rateLimitConfigs for convenience
export { rateLimitConfigs } from "./rate-limit";

// Allowed origins for CSRF protection
const ALLOWED_ORIGINS = [
  "https://cursorboston.com",
  "https://www.cursorboston.com",
  "http://localhost:3000",
  "http://localhost:3001",
];

/**
 * Check if the request origin is allowed (CSRF protection).
 * Returns true if the origin is valid or if no origin check is needed (GET, HEAD, OPTIONS).
 *
 * @param request - Incoming Next.js request.
 * @returns `true` if the method is safe or the origin/referer matches the allowlist (or dev fallback).
 */
export function isOriginAllowed(request: NextRequest): boolean {
  // Skip origin check for safe methods
  const method = request.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return true;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // If no origin header, check referer (some browsers don't send origin)
  if (!origin && !referer) {
    // Allow requests without origin/referer in development only
    return process.env.NODE_ENV === "development";
  }

  // Check if origin matches allowed list
  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin)) {
      return true;
    }
    // Allow if origin matches the app URL from environment
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl && origin === new URL(appUrl).origin) {
      return true;
    }
    return false;
  }

  // Check referer as fallback
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (ALLOWED_ORIGINS.includes(refererOrigin)) {
        return true;
      }
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (appUrl && refererOrigin === new URL(appUrl).origin) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * CSRF protection middleware for state-changing operations.
 * Validates origin header against allowed origins.
 *
 * @param handler - Next.js API handler that runs after the origin check passes.
 * @returns A handler that responds with 403 when the origin is not allowed.
 */
export function withCsrfProtection(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    if (!isOriginAllowed(request)) {
      logger.warn("CSRF protection blocked request", {
        origin: request.headers.get("origin"),
        referer: request.headers.get("referer"),
        method: request.method,
        path: new URL(request.url).pathname,
      });
      return NextResponse.json(
        { error: "Forbidden: Invalid origin" },
        { status: 403 }
      );
    }
    return handler(request);
  };
}

/**
 * Rate limit middleware for Next.js API routes
 *
 * @param options - Sliding window size and max requests per window.
 * @param handler - Inner handler invoked when under the limit.
 * @returns A handler that may return 429 with `Retry-After` when exceeded.
 */
export function withRateLimitMiddleware(
  options: {
    windowMs: number;
    maxRequests: number;
  },
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Convert NextRequest to Request-like object for identifier extraction
    const identifier = getClientIdentifier(request as unknown as Request);
    const result = checkRateLimit(identifier, options);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfter || 60),
            "X-RateLimit-Limit": String(options.maxRequests),
            "X-RateLimit-Remaining": String(result.remaining),
            "X-RateLimit-Reset": String(result.resetTime),
          },
        }
      );
    }

    // Call the handler
    const response = await handler(request);

    // Add rate limit headers to response
    const headers = new Headers(response.headers);
    headers.set("X-RateLimit-Limit", String(options.maxRequests));
    headers.set("X-RateLimit-Remaining", String(result.remaining));
    headers.set("X-RateLimit-Reset", String(result.resetTime));

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

/**
 * Logs each request with timing, status, optional IP/UA, and adds `X-Request-ID` to the response.
 * Catches handler errors and returns a JSON 500 with the same request id.
 *
 * @param handler - Inner Next.js API handler.
 * @returns Wrapped handler that performs structured logging around the inner call.
 */
export function withLoggingMiddleware(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      const response = await handler(request);
      const duration = Date.now() - startTime;

      // Log the request
      const url = new URL(request.url);
      const metadata: Record<string, unknown> = {
        method: request.method,
        path: url.pathname,
        statusCode: response.status,
        duration,
        requestId,
      };

      // Get client IP
      const forwarded = request.headers.get("x-forwarded-for");
      const realIp = request.headers.get("x-real-ip");
      const cfConnectingIp = request.headers.get("cf-connecting-ip");
      const ip = forwarded?.split(",")[0]?.trim() || realIp || cfConnectingIp;
      if (ip) {
        metadata.ip = ip;
      }

      // Get user agent
      const userAgent = request.headers.get("user-agent");
      if (userAgent) {
        metadata.userAgent = userAgent;
      }

      const level = response.status >= 500
        ? "ERROR"
        : response.status >= 400
        ? "WARN"
        : "INFO";

      if (level === "ERROR") {
        logger.error("API Request", metadata);
      } else if (level === "WARN") {
        logger.warn("API Request", metadata);
      } else {
        logger.info("API Request", metadata);
      }

      // Add request ID to response headers
      const headers = new Headers(response.headers);
      headers.set("X-Request-ID", requestId);

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logError(error, {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        duration,
      });

      // Return error response
      return NextResponse.json(
        {
          error: "Internal server error",
          requestId,
        },
        {
          status: 500,
          headers: {
            "X-Request-ID": requestId,
          },
        }
      );
    }
  };
}

/**
 * Composes logging, CSRF protection, and rate limiting (in that nesting order: log → CSRF → rate limit → handler).
 *
 * @param rateLimitOptions - Sliding window for {@link withRateLimitMiddleware}.
 * @param handler - Final API handler.
 * @returns Combined Next.js route handler.
 * @example
 * export const POST = withMiddleware(
 *   { windowMs: 60_000, maxRequests: 60 },
 *   async (request) => NextResponse.json({ ok: true })
 * );
 */
export function withMiddleware(
  rateLimitOptions: {
    windowMs: number;
    maxRequests: number;
  },
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return withLoggingMiddleware(
    withCsrfProtection(
      withRateLimitMiddleware(rateLimitOptions, handler)
    )
  );
}

/**
 * Middleware without rate limiting (for routes that already have custom rate limiting)
 *
 * @param handler - Inner API handler.
 * @returns Wrapped handler with {@link withLoggingMiddleware} and {@link withCsrfProtection}.
 */
export function withSecurityMiddleware(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return withLoggingMiddleware(
    withCsrfProtection(handler)
  );
}
