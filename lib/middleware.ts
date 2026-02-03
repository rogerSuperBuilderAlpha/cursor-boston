/**
 * Next.js Middleware Utilities
 * 
 * Wrappers for rate limiting, logging, and CSRF protection that work with Next.js API routes
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitConfigs, getClientIdentifier } from "./rate-limit";
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
    // Allow requests without origin/referer in development
    if (process.env.NODE_ENV === "development") {
      return true;
    }
    // In production, requests from the same origin may not have origin header
    // This is less restrictive but acceptable for API routes using Bearer tokens
    return true;
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
 * Logging middleware for Next.js API routes
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
 * Combine rate limiting, CSRF protection, and logging middleware
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
 */
export function withSecurityMiddleware(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return withLoggingMiddleware(
    withCsrfProtection(handler)
  );
}
