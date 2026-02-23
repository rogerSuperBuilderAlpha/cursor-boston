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
 * Create a standardized error response.
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
 * Create a standardized success response.
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
