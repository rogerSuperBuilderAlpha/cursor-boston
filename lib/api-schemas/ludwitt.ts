/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Ludwitt-area API contracts. PKCE OAuth flow that links a user to a
 * Ludwitt account, then proxies Anthropic-shaped requests through the
 * shared Ludwitt credit pool.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema } from "./common";

const c = initContract();

const PassthroughOk = z.object({}).passthrough();
const RedirectResponse = z.object({}).optional();

const ConnectStartBody = z
  .object({
    returnTo: z.string().optional(),
  })
  .partial()
  .optional()
  .openapi("LudwittConnectStartBody");

const AiMessagesBody = z
  .object({
    model: z.string().min(1),
    max_tokens: z.number().int().positive(),
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.unknown(),
        })
      )
      .min(1),
    system: z.string().optional(),
    temperature: z.number().optional(),
  })
  .passthrough()
  .openapi("LudwittAiMessagesBody");

export const ludwittContract = c.router(
  {
    authorize: {
      method: "GET",
      path: "/api/ludwitt/authorize",
      summary: "Begin Ludwitt OAuth (PKCE) — redirects to Ludwitt",
      responses: { 302: RedirectResponse },
      metadata: { errorCodes: [] as const },
    },
    connectStart: {
      method: "POST",
      path: "/api/ludwitt/connect-start",
      summary: "Authenticated PKCE handshake — returns the authorize URL",
      body: ConnectStartBody,
      responses: {
        200: PassthroughOk,
        401: ApiErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    finalizeToken: {
      method: "POST",
      path: "/api/ludwitt/finalize-token",
      summary: "Trade the one-time finalize cookie for the linked-account token",
      body: z.object({}).optional(),
      responses: {
        200: PassthroughOk,
        410: ApiErrorSchema.openapi({ description: "Cookie expired" }),
      },
      metadata: { errorCodes: [] as const },
    },
    disconnect: {
      method: "POST",
      path: "/api/ludwitt/disconnect",
      summary: "Disconnect the Ludwitt link for the current user",
      body: z.object({}).optional(),
      responses: {
        200: PassthroughOk,
        401: ApiErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    aiMessages: {
      method: "POST",
      path: "/api/ludwitt/ai/messages",
      summary: "Proxy an Anthropic Messages-shaped request through Ludwitt",
      body: AiMessagesBody,
      responses: {
        200: PassthroughOk,
        400: ApiErrorSchema,
        401: ApiErrorSchema,
        402: ApiErrorSchema.openapi({ description: "Out of credits" }),
        412: ApiErrorSchema.openapi({ description: "Ludwitt not connected" }),
        500: ApiErrorSchema,
        502: ApiErrorSchema.openapi({ description: "Upstream failed" }),
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
