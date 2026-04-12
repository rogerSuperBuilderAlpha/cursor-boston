/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextResponse } from "next/server";

/**
 * Standard error codes for API responses.
 */
export const ErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  CONFLICT: "CONFLICT",
  SERVER_ERROR: "SERVER_ERROR",
  NOT_CONFIGURED: "NOT_CONFIGURED",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Build a JSON error response for API routes.
 *
 * @param message - User-facing or developer error text.
 * @param status - HTTP status code.
 * @param code - Optional {@link ErrorCodeType}; inferred from `status` when omitted.
 * @returns `NextResponse` with JSON payload.
 */
export function apiError(
  message: string,
  status: number,
  code?: ErrorCodeType
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code: code ?? inferErrorCode(status),
      },
    },
    { status }
  );
}

/**
 * Build a JSON success response for API routes.
 *
 * @param data - Serializable fields to merge into the response object.
 * @param status - HTTP status (default 200).
 * @returns `NextResponse` with JSON payload.
 */
export function apiSuccess<T extends Record<string, unknown>>(
  data: T,
  status: number = 200
): NextResponse {
  return NextResponse.json({ success: true, ...data }, { status });
}

function inferErrorCode(status: number): ErrorCodeType {
  switch (status) {
    case 401:
      return ErrorCode.UNAUTHORIZED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 409:
      return ErrorCode.CONFLICT;
    case 429:
      return ErrorCode.RATE_LIMITED;
    default:
      return status >= 400 && status < 500
        ? ErrorCode.VALIDATION_ERROR
        : ErrorCode.SERVER_ERROR;
  }
}
