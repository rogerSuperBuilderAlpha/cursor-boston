/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { createHash } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "./firebase-admin";
import { checkRateLimit, getClientIdentifier } from "./rate-limit";
import { logger } from "./logger";

interface ServerRateLimitOptions {
  scope: string;
  windowMs: number;
  maxRequests: number;
  identifier?: string;
  fallbackMode?: "strict-memory" | "memory" | "deny";
  fallbackMaxRequests?: number;
  successSampleRate?: number;
}

export interface ServerRateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  source: "firestore" | "memory-fallback" | "fail-closed";
  statusCode?: number;
}

function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function toRetryAfter(resetTime: number, now: number): number {
  return Math.max(1, Math.ceil((resetTime - now) / 1000));
}

/**
 * Production-oriented server rate limit.
 *
 * Uses Firestore transactions for cross-instance consistency when Admin DB is available.
 * Fallback behavior is explicit per endpoint:
 * - "strict-memory" (default): bounded in-memory fallback with tighter limits.
 * - "memory": in-memory fallback with same limits.
 * - "deny": fail closed (503) when distributed limiter is unavailable.
 *
 * NOTE: Any memory fallback is resilience-only and not equivalent to distributed protection.
 */
export async function checkServerRateLimit(
  request: Request,
  options: ServerRateLimitOptions
): Promise<ServerRateLimitResult> {
  const now = Date.now();
  const identifier = options.identifier || getClientIdentifier(request) || "unknown";
  const resetTime = Math.floor(now / options.windowMs) * options.windowMs + options.windowMs;
  const bucket = Math.floor(now / options.windowMs);
  const fallbackMode = options.fallbackMode ?? "strict-memory";
  const successSampleRate = Math.max(1, options.successSampleRate ?? 100);
  const fallbackMaxRequests = Math.max(
    1,
    options.fallbackMaxRequests ??
      (fallbackMode === "strict-memory"
        ? Math.min(options.maxRequests, 10)
        : options.maxRequests)
  );

  const db = getAdminDb();
  const fallback = (): ServerRateLimitResult => {
    if (fallbackMode === "deny") {
      return {
        success: false,
        remaining: 0,
        resetTime,
        retryAfter: toRetryAfter(resetTime, now),
        source: "fail-closed",
        statusCode: 503,
      };
    }

    const memoryFallback = checkRateLimit(
      `fallback:${options.scope}:${identifier}`,
      { windowMs: options.windowMs, maxRequests: fallbackMaxRequests }
    );
    return {
      ...memoryFallback,
      source: "memory-fallback",
    };
  };

  if (!db) {
    const fallbackResult = fallback();
    logger.warn("rate_limit_observation", {
      metric: "rate_limit_source_mix",
      scope: options.scope,
      source: fallbackResult.source,
      success: fallbackResult.success,
      statusCode: fallbackResult.statusCode ?? null,
      fallbackMode,
      reason: "admin_db_unavailable",
    });
    return fallbackResult;
  }

  const identifierHash = hashIdentifier(identifier);
  const docId = `${options.scope}:${bucket}:${identifierHash}`;
  const docRef = db.collection("apiRateLimits").doc(docId);
  const shouldSampleSuccess = parseInt(identifierHash.slice(0, 8), 16) % successSampleRate === 0;

  try {
    const txResult = await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      const currentCount = snap.exists ? Number(snap.data()?.count || 0) : 0;

      if (currentCount >= options.maxRequests) {
        return {
          allowed: false,
          count: currentCount,
        };
      }

      const nextCount = currentCount + 1;
      const basePayload = {
        count: nextCount,
        updatedAt: Timestamp.now(),
      };

      if (!snap.exists) {
        tx.set(docRef, {
          ...basePayload,
          scope: options.scope,
          identifierHash,
          bucket,
          windowMs: options.windowMs,
          resetTimeMs: resetTime,
          // Keep for operational cleanup / optional Firestore TTL.
          // Cleanup route: POST /api/internal/rate-limits/cleanup (CRON_SECRET protected).
          expiresAt: Timestamp.fromMillis(resetTime + options.windowMs),
        });
      } else {
        // Existing buckets only need count/updatedAt to reduce write payload pressure.
        tx.set(docRef, basePayload, { merge: true });
      }

      return {
        allowed: true,
        count: nextCount,
      };
    });

    if (!txResult.allowed) {
      const deniedResult: ServerRateLimitResult = {
        success: false,
        remaining: 0,
        resetTime,
        retryAfter: toRetryAfter(resetTime, now),
        source: "firestore",
      };
      logger.warn("rate_limit_observation", {
        metric: "rate_limit_source_mix",
        scope: options.scope,
        source: deniedResult.source,
        success: deniedResult.success,
        statusCode: deniedResult.statusCode ?? 429,
        fallbackMode,
        reason: "quota_exceeded",
      });
      return deniedResult;
    }

    const successResult: ServerRateLimitResult = {
      success: true,
      remaining: Math.max(0, options.maxRequests - txResult.count),
      resetTime,
      source: "firestore",
    };
    if (shouldSampleSuccess) {
      logger.info("rate_limit_observation", {
        metric: "rate_limit_source_mix",
        scope: options.scope,
        source: successResult.source,
        success: successResult.success,
        statusCode: 200,
        fallbackMode,
        reason: "allowed_sampled",
        sampleRate: successSampleRate,
      });
    }

    return successResult;
  } catch (error) {
    const fallbackResult = fallback();
    logger.warn("rate_limit_observation", {
      metric: "rate_limit_source_mix",
      scope: options.scope,
      source: fallbackResult.source,
      success: fallbackResult.success,
      statusCode: fallbackResult.statusCode ?? null,
      fallbackMode,
      reason: "firestore_transaction_error",
      error: error instanceof Error ? error.message : String(error),
    });
    return fallbackResult;
  }
}

export function buildRateLimitHeaders(
  result: ServerRateLimitResult,
  maxRequests: number
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(maxRequests),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetTime),
    "X-RateLimit-Source": result.source,
  };

  if (result.retryAfter) {
    headers["Retry-After"] = String(result.retryAfter);
  }

  return headers;
}
