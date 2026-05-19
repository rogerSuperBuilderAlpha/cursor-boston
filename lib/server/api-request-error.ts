/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export function requestErrorId(): string {
  return randomUUID().slice(0, 8);
}

/** Log the error with an `errorId` and return a JSON body that includes it. */
export function jsonWithLoggedError(
  status: number,
  err: unknown,
  body: Record<string, unknown>,
  logMeta: Record<string, string | undefined>
): NextResponse {
  const errorId = requestErrorId();
  logger.logError(err instanceof Error ? err : new Error(String(err)), {
    ...logMeta,
    errorId,
  });
  return NextResponse.json({ ...body, errorId }, { status });
}

export function jsonWithLoggedMessage(
  status: number,
  message: string,
  body: Record<string, unknown>,
  logMeta: Record<string, string | undefined>
): NextResponse {
  const errorId = requestErrorId();
  logger.logError(new Error(message), {
    ...logMeta,
    errorId,
  });
  return NextResponse.json({ ...body, errorId }, { status });
}
