/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Shared schema fragments used across all API contracts.
 *
 * - Auth scheme (Firebase Bearer token / cookie)
 * - Standard error envelope (mirrors lib/api-response.ts)
 * - Pagination params (mirrors lib/firestore-pagination.ts)
 * - Rate-limit response shape
 *
 * Every endpoint contract should compose these where applicable so the
 * generated OpenAPI spec uses one consistent schema for each concept.
 */

import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { ErrorCode } from "@/lib/api-response";

// Patch zod with the .openapi() metadata method. Called once here; importing
// any contract module pulls this in transitively, so per-route schemas can
// freely use .openapi() for examples and component naming.
extendZodWithOpenApi(z);

/** All known error codes the API can emit. Mirrors lib/api-response.ts. */
export const ErrorCodeEnum = z.enum([
  ErrorCode.UNAUTHORIZED,
  ErrorCode.FORBIDDEN,
  ErrorCode.NOT_FOUND,
  ErrorCode.VALIDATION_ERROR,
  ErrorCode.RATE_LIMITED,
  ErrorCode.CONFLICT,
  ErrorCode.SERVER_ERROR,
  ErrorCode.NOT_CONFIGURED,
]);

/** Standard error response envelope produced by lib/api-response.ts#apiError. */
export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    message: z.string(),
    code: ErrorCodeEnum,
  }),
});

/** 429 rate-limit response, including retryAfter hint. */
export const RateLimitedErrorSchema = z.object({
  error: z.string(),
  retryAfterSeconds: z.number().int().nonnegative().optional(),
});

/** Cursor-based pagination query params. Mirrors lib/firestore-pagination.ts. */
export const PaginationQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .describe("Page size; default 20, max 100"),
  cursor: z
    .string()
    .optional()
    .describe("Opaque cursor returned as `nextCursor` from the previous page"),
});

/** Fields appended to every paginated response. */
export const PaginationFieldsSchema = z.object({
  nextCursor: z
    .string()
    .nullable()
    .describe("Cursor for the next page, or null if there are no more"),
  hasMore: z
    .boolean()
    .describe("True if more items exist beyond this page"),
});

/**
 * The two security schemes the API accepts. The `bearerAuth` form uses a
 * Firebase Auth ID token in `Authorization: Bearer <token>`. The `cookieAuth`
 * form is set during in-app sessions and is preferred for browser callers.
 */
export const SECURITY_SCHEMES = {
  bearerAuth: {
    type: "http" as const,
    scheme: "bearer" as const,
    bearerFormat: "Firebase ID token",
    description:
      "Firebase Auth ID token. Obtain via Firebase Auth client SDK and pass as `Authorization: Bearer <token>`.",
  },
  cookieAuth: {
    type: "apiKey" as const,
    in: "cookie" as const,
    name: "session",
    description: "Session cookie set by /api/auth/* during sign-in.",
  },
};

/** Convenience: the same security requirement that 105+ routes use. */
export const REQUIRES_AUTH = [{ bearerAuth: [] }, { cookieAuth: [] }];
