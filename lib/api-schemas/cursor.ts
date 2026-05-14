/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Cursor-area API contracts. Covers connecting and disconnecting a user's
 * Cursor API key. Agent spawning is intentionally not part of this contract yet.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema, RateLimitedErrorSchema } from "./common";

const c = initContract();

const CursorConnectBody = z
  .object({
    apiKey: z.string().min(1, "Cursor API key is required"),
    monthlyCapUsd: z.union([z.literal(0), z.literal(5), z.literal(25), z.literal(100)]),
  })
  .openapi("CursorConnectBody");

const CursorConnectResponse = z
  .object({
    ok: z.literal(true),
    fingerprint: z.string(),
    defaultModel: z.string().optional(),
  })
  .openapi("CursorConnectResponse");

const CursorDisconnectResponse = z
  .object({
    disconnected: z.literal(true),
  })
  .openapi("CursorDisconnectResponse");

export const cursorContract = c.router(
  {
    connect: {
      method: "POST",
      path: "/api/cursor/connect",
      summary: "Validate and store the current user's Cursor API key",
      body: CursorConnectBody,
      responses: {
        200: CursorConnectResponse,
        400: ApiErrorSchema,
        401: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    disconnect: {
      method: "POST",
      path: "/api/cursor/disconnect",
      summary: "Disconnect the current user's Cursor API key",
      body: z.object({}).optional(),
      responses: {
        200: CursorDisconnectResponse,
        401: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
