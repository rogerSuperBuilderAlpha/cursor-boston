/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema } from "./common";

const c = initContract();

const writeErrors = {
  400: ApiErrorSchema.openapi({ description: "Validation error" }),
  401: ApiErrorSchema.openapi({ description: "Authentication required" }),
  500: ApiErrorSchema,
} as const;

const SuccessTrue = z.object({
  success: z.literal(true),
  message: z.string().optional(),
});

const ResolveEmailBody = z
  .object({
    email: z
      .string()
      .min(1, "Email is required")
      .describe("Email to resolve. Case-insensitive; whitespace trimmed server-side."),
  })
  .openapi("AuthResolveEmailBody", { example: { email: "user+alias@example.com" } });

const ChangePrimaryEmailBody = z
  .object({ newPrimaryEmail: z.string().min(1) })
  .openapi("AuthChangePrimaryEmailBody");

const RemoveEmailBody = z
  .object({ email: z.string().min(1) })
  .openapi("AuthRemoveEmailBody");

const SendEmailVerificationBody = z
  .object({ email: z.string().min(1) })
  .openapi("AuthSendEmailVerificationBody");

const VerifyEmailQuery = z.object({ token: z.string().min(1) });

const ResolveEmailFoundSchema = z
  .object({ primaryEmail: z.string(), isAlias: z.boolean() })
  .openapi("AuthResolveEmailFound", {
    example: { primaryEmail: "user@example.com", isAlias: true },
  });

const ResolveEmailNotFoundSchema = z
  .object({
    primaryEmail: z.null(),
    isAlias: z.literal(false),
    message: z.string(),
  })
  .openapi("AuthResolveEmailNotFound", {
    example: { primaryEmail: null, isAlias: false, message: "Email not found" },
  });

export const authContract = c.router(
  {
    resolveEmail: {
      method: "POST",
      path: "/api/auth/resolve-email",
      summary: "Resolve an email (or alias) to its primary account email",
      description:
        "Used during login to resolve secondary/alias emails to the canonical primary email. Public endpoint — does not require authentication. Returns 200 even when no account is found, to avoid leaking which emails are registered.",
      body: ResolveEmailBody,
      responses: {
        200: z.union([ResolveEmailFoundSchema, ResolveEmailNotFoundSchema]),
        400: ApiErrorSchema.openapi({ description: "Email field missing or empty" }),
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["VALIDATION_ERROR", "SERVER_ERROR", "NOT_CONFIGURED"] as const },
    },
    changePrimaryEmail: {
      method: "POST",
      path: "/api/auth/change-primary-email",
      summary: "Promote an additional verified email to primary",
      body: ChangePrimaryEmailBody,
      responses: { 200: SuccessTrue, ...writeErrors, 404: ApiErrorSchema },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "NOT_FOUND", "SERVER_ERROR"] as const,
      },
    },
    removeEmail: {
      method: "POST",
      path: "/api/auth/remove-email",
      summary: "Remove an additional email from the account",
      body: RemoveEmailBody,
      responses: {
        200: z.object({ success: z.literal(true) }),
        ...writeErrors,
        404: ApiErrorSchema,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "NOT_FOUND", "SERVER_ERROR"] as const,
      },
    },
    sendEmailVerification: {
      method: "POST",
      path: "/api/auth/send-email-verification",
      summary: "Send a verification email for an additional email",
      body: SendEmailVerificationBody,
      responses: { 200: SuccessTrue, ...writeErrors },
      metadata: { errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const },
    },
    verifyEmail: {
      method: "GET",
      path: "/api/auth/verify-email",
      summary: "Verify an email via tokenized link (redirects to /profile)",
      description:
        "GET handler triggered by emailed magic link. On success/failure it redirects (302) to /profile with success/error query params; clients should follow the redirect rather than read the body.",
      query: VerifyEmailQuery,
      responses: {
        302: z.unknown().describe("Redirect to /profile with status query params"),
        400: ApiErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["VALIDATION_ERROR", "SERVER_ERROR"] as const },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
