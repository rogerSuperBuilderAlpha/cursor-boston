/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * GitHub-area API contracts. OAuth (authorize/callback) plus a public
 * webhook receiver (HMAC-signed by github.com — body is verified ahead
 * of any contract-level parsing).
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema } from "./common";

const c = initContract();

const RedirectResponse = z.object({}).optional();
const PassthroughOk = z.object({}).passthrough();

const AuthorizeQuery = z.object({
  returnTo: z.string().optional(),
});

const CallbackQuery = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
});

export const githubContract = c.router(
  {
    authorize: {
      method: "GET",
      path: "/api/github/authorize",
      summary: "Begin GitHub OAuth — redirects to github.com",
      query: AuthorizeQuery,
      responses: { 302: RedirectResponse, 500: ApiErrorSchema },
      metadata: { errorCodes: ["SERVER_ERROR"] as const },
    },
    callback: {
      method: "GET",
      path: "/api/github/callback",
      summary: "GitHub OAuth callback — finishes the link and redirects",
      query: CallbackQuery,
      responses: { 302: RedirectResponse, 429: ApiErrorSchema },
      metadata: { errorCodes: ["RATE_LIMITED"] as const },
    },
    webhookPing: {
      method: "GET",
      path: "/api/github/webhook",
      summary: "Webhook health-check (GitHub fires GET on initial setup)",
      responses: { 200: PassthroughOk },
      metadata: { errorCodes: [] as const },
    },
    webhook: {
      method: "POST",
      path: "/api/github/webhook",
      summary: "GitHub webhook receiver (HMAC-signed by github.com)",
      description:
        "Body is verified via X-Hub-Signature-256 before any contract validation. The body shape mirrors the GitHub Webhooks API.",
      body: PassthroughOk,
      responses: {
        200: PassthroughOk,
        400: ApiErrorSchema,
        401: ApiErrorSchema.openapi({ description: "Invalid signature" }),
        413: ApiErrorSchema.openapi({ description: "Payload too large" }),
        429: ApiErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "RATE_LIMITED", "SERVER_ERROR"] as const,
      },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
