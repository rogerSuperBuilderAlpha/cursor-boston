/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema, RateLimitedErrorSchema } from "./common";

const c = initContract();

const DeleteAccountBody = z
  .object({
    confirmText: z
      .literal("DELETE")
      .describe("Must be the exact string 'DELETE' to confirm intent"),
  })
  .openapi("AccountDeleteBody");

const DeleteAccountResponse = z.object({
  success: z.boolean(),
  uid: z.string(),
  stepsCompleted: z.array(z.string()),
  errors: z.array(z.string()),
  message: z.string(),
});

const PurgeResponse = z.object({
  success: z.literal(true),
  completedCount: z.number().int().nonnegative(),
  completedUids: z.array(z.string()),
});

export const accountContract = c.router(
  {
    deleteAccount: {
      method: "DELETE",
      path: "/api/account",
      summary: "GDPR Article 17: delete the current user's account",
      description:
        "Cascading deletion of the user's data via the registered cleanup pipeline. Requires fresh auth (auth_time within the last 5 minutes) and `confirmText: \"DELETE\"`.",
      body: DeleteAccountBody,
      responses: {
        200: DeleteAccountResponse,
        400: ApiErrorSchema.openapi({ description: "Validation error" }),
        401: ApiErrorSchema.openapi({ description: "Authentication required" }),
        403: ApiErrorSchema.openapi({ description: "Re-authentication required (auth_time stale)" }),
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "VALIDATION_ERROR",
          "RATE_LIMITED",
          "SERVER_ERROR",
        ] as const,
      },
    },
    purge: {
      method: "POST",
      path: "/api/account/purge",
      summary: "Cron-only: resume stale 30-day account deletions",
      description:
        "HMAC-authenticated via header. Picks up `accountDeletions` docs older than 30 days and finishes their cascade.",
      body: z.object({}).optional(),
      responses: {
        200: PurgeResponse,
        403: ApiErrorSchema.openapi({ description: "Missing or invalid HMAC signature" }),
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["FORBIDDEN", "SERVER_ERROR"] as const },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
