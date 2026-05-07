/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema } from "./common";

const c = initContract();

const ResolveEmailBodySchema = z
  .object({
    email: z
      .string()
      .min(1, "Email is required")
      .describe(
        "Email to resolve. Case-insensitive; whitespace is trimmed server-side."
      ),
  })
  .openapi("AuthResolveEmailBody", {
    example: { email: "user+alias@example.com" },
  });

const ResolveEmailFoundSchema = z
  .object({
    primaryEmail: z.string(),
    isAlias: z.boolean(),
  })
  .openapi("AuthResolveEmailFound", {
    description:
      "Email resolved. `isAlias=false` means the email is itself a primary; `true` means it's a secondary email and `primaryEmail` is the canonical one.",
    example: {
      primaryEmail: "user@example.com",
      isAlias: true,
    },
  });

const ResolveEmailNotFoundSchema = z
  .object({
    primaryEmail: z.null(),
    isAlias: z.literal(false),
    message: z.string(),
  })
  .openapi("AuthResolveEmailNotFound", {
    description:
      "No account matched. Returned with HTTP 200 to avoid email enumeration leakage.",
    example: {
      primaryEmail: null,
      isAlias: false,
      message: "Email not found",
    },
  });

export const authContract = c.router(
  {
    resolveEmail: {
      method: "POST",
      path: "/api/auth/resolve-email",
      summary: "Resolve an email (or alias) to its primary account email",
      description:
        "Used during login to resolve secondary/alias emails to the canonical primary email. Public endpoint — does not require authentication. Returns a successful 200 even when no account is found, to avoid leaking which emails are registered.",
      body: ResolveEmailBodySchema,
      responses: {
        200: z.union([ResolveEmailFoundSchema, ResolveEmailNotFoundSchema]),
        400: ApiErrorSchema.openapi({
          description: "Email field missing or empty",
        }),
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: ["VALIDATION_ERROR", "SERVER_ERROR", "NOT_CONFIGURED"] as const,
      },
    },
  },
  {
    pathPrefix: "",
    strictStatusCodes: true,
  }
);
