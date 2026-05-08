/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Agents-area API contracts. Covers agent registration, claim flow,
 * authenticated agent self-service, and human-owner agent listings.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema, RateLimitedErrorSchema } from "./common";

const c = initContract();

const baseErrors = {
  401: ApiErrorSchema.openapi({ description: "Authentication required" }),
  500: ApiErrorSchema,
} as const;

const writeErrors = {
  ...baseErrors,
  400: ApiErrorSchema.openapi({ description: "Validation error" }),
  429: RateLimitedErrorSchema.openapi({ description: "Rate limit exceeded" }),
} as const;

const PassthroughOk = z.object({}).passthrough();

const NameField = z
  .string()
  .min(2)
  .max(50)
  .regex(/^[a-zA-Z0-9\s\-_]+$/);

const RegisterBody = z
  .object({
    name: NameField,
    description: z.string().max(500).optional(),
  })
  .openapi("AgentRegisterBody");

const VisibilityPatch = z
  .object({
    isPublic: z.boolean().optional(),
    showOwner: z.boolean().optional(),
  })
  .partial()
  .openapi("AgentVisibilityPatch");

const MePatchBody = z
  .object({
    name: NameField.optional(),
    description: z.string().max(500).nullable().optional(),
    avatarUrl: z.string().url().nullable().optional(),
    visibility: VisibilityPatch.optional(),
  })
  .openapi("AgentProfilePatchBody");

const ClaimTokenParam = z.object({ token: z.string().min(1) });

export const agentsContract = c.router(
  {
    register: {
      method: "POST",
      path: "/api/agents/register",
      summary: "Register a new agent (returns API key + claim URL)",
      body: RegisterBody,
      responses: {
        200: PassthroughOk,
        ...writeErrors,
        409: ApiErrorSchema.openapi({ description: "Agent already registered" }),
      },
      metadata: {
        errorCodes: [
          "VALIDATION_ERROR",
          "RATE_LIMITED",
          "CONFLICT",
          "SERVER_ERROR",
        ] as const,
      },
    },
    me: {
      method: "GET",
      path: "/api/agents/me",
      summary: "Get the authenticated agent's profile",
      responses: {
        200: PassthroughOk,
        ...baseErrors,
        429: RateLimitedErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "RATE_LIMITED", "SERVER_ERROR"] as const },
    },
    mePatch: {
      method: "PATCH",
      path: "/api/agents/me",
      summary: "Update the authenticated agent's profile",
      body: MePatchBody,
      responses: { 200: PassthroughOk, ...writeErrors },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "VALIDATION_ERROR",
          "RATE_LIMITED",
          "SERVER_ERROR",
        ] as const,
      },
    },
    user: {
      method: "GET",
      path: "/api/agents/user",
      summary: "List agents owned by the authenticated user",
      responses: {
        200: PassthroughOk,
        ...baseErrors,
        429: RateLimitedErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "RATE_LIMITED", "SERVER_ERROR"] as const },
    },
    claimGet: {
      method: "GET",
      path: "/api/agents/claim/:token",
      pathParams: ClaimTokenParam,
      summary: "Get info about an agent pending claim",
      responses: {
        200: PassthroughOk,
        400: ApiErrorSchema,
        404: ApiErrorSchema.openapi({ description: "Invalid or expired claim token" }),
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["NOT_FOUND", "RATE_LIMITED", "SERVER_ERROR"] as const },
    },
    claimPost: {
      method: "POST",
      path: "/api/agents/claim/:token",
      pathParams: ClaimTokenParam,
      summary: "Claim an agent (link to authenticated user)",
      body: z.object({}).optional(),
      responses: {
        200: PassthroughOk,
        ...writeErrors,
        404: ApiErrorSchema.openapi({ description: "Invalid or expired claim token" }),
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "VALIDATION_ERROR",
          "NOT_FOUND",
          "RATE_LIMITED",
          "SERVER_ERROR",
        ] as const,
      },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
