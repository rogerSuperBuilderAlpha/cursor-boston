/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
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
  429: RateLimitedErrorSchema,
} as const;
// ──────────────────── Body / query schemas ────────────────────

const ProfileDataQuery = z
  .object({
    reconcileGithub: z.enum(["0", "1"]).optional(),
    format: z.enum(["portable"]).optional(),
  })
  .openapi("ProfileDataQuery");

const SubscriptionPatchBody = z
  .object({ subscribed: z.boolean() })
  .openapi("ProfileSubscriptionPatchBody");

const SocialLinksSchema = z
  .object({
    github: z.string().optional(),
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
    website: z.string().optional(),
    substack: z.string().optional(),
  })
  .partial()
  .passthrough();

const UpdateBody = z
  .object({
    displayName: z.string().optional(),
    bio: z.string().optional(),
    location: z.string().optional(),
    company: z.string().optional(),
    jobTitle: z.string().optional(),
    socialLinks: SocialLinksSchema.optional(),
  })
  .openapi("ProfileUpdateBody");

const VisibilityPatchBody = z
  .object({
    isPublic: z.boolean().optional(),
    showEmail: z.boolean().optional(),
    showBio: z.boolean().optional(),
    showLocation: z.boolean().optional(),
    showCompany: z.boolean().optional(),
    showJobTitle: z.boolean().optional(),
    showDiscord: z.boolean().optional(),
    showGithubBadge: z.boolean().optional(),
    showEventsAttended: z.boolean().optional(),
    showTalksGiven: z.boolean().optional(),
    showWebsite: z.boolean().optional(),
    showLinkedIn: z.boolean().optional(),
    showTwitter: z.boolean().optional(),
    showGithub: z.boolean().optional(),
    showSubstack: z.boolean().optional(),
    showMemberSince: z.boolean().optional(),
  })
  .openapi("ProfileVisibilityPatchBody");

// ──────────────────── Response schemas ────────────────────

const ProfileDataResponse = z
  .object({})
  .passthrough()
  .openapi("ProfileDataResponse", {
    description:
      "User profile data bundle. With `?format=portable`, wrapped as `{ schema, version, exportedAt, data }` for GDPR Article 20 portability.",
  });

const ReconcileGithubResponse = z.object({
  success: z.literal(true),
  githubLogin: z.string(),
  mergedPrCount: z.number().int().nonnegative(),
  syncedPrCount: z.number().int().nonnegative(),
});

const SubscriptionGetResponse = z.object({
  onList: z.boolean(),
  subscribed: z.boolean(),
});

const SubscriptionPatchResponse = z.object({ subscribed: z.boolean() });

const VisibilityFlagsSchema = z.object({}).passthrough();

const VisibilityGetResponse = z.object({
  success: z.literal(true),
  profile: VisibilityFlagsSchema,
});

const VisibilityPatchResponse = z.object({
  success: z.literal(true),
  visibility: VisibilityFlagsSchema,
});

const UpdateResponse = z.object({
  success: z.literal(true),
  profile: z
    .object({
      displayName: z.string().optional(),
      bio: z.string().optional(),
      location: z.string().optional(),
      company: z.string().optional(),
      jobTitle: z.string().optional(),
      socialLinks: SocialLinksSchema.optional(),
    })
    .passthrough(),
});

// ──────────────────── Contract ────────────────────

export const profileContract = c.router(
  {
    data: {
      method: "GET",
      path: "/api/profile/data",
      summary: "Get the current user's profile data (with optional GDPR-portable export)",
      query: ProfileDataQuery,
      responses: { 200: ProfileDataResponse, ...writeErrors },
      metadata: { errorCodes: ["UNAUTHORIZED", "RATE_LIMITED", "SERVER_ERROR"] as const },
    },
    githubReconcile: {
      method: "POST",
      path: "/api/profile/github/reconcile",
      summary: "Reconcile merged-PR counts from the connected GitHub account",
      body: z.object({}).optional(),
      responses: {
        200: ReconcileGithubResponse,
        ...writeErrors,
        404: ApiErrorSchema,
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "VALIDATION_ERROR",
          "RATE_LIMITED",
          "NOT_FOUND",
          "SERVER_ERROR",
        ] as const,
      },
    },
    subscriptionGet: {
      method: "GET",
      path: "/api/profile/subscription",
      summary: "Get the current user's email-subscription status",
      responses: {
        200: SubscriptionGetResponse,
        ...baseErrors,
        404: ApiErrorSchema,
        429: RateLimitedErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "NOT_FOUND", "RATE_LIMITED", "SERVER_ERROR"] as const },
    },
    subscriptionPatch: {
      method: "PATCH",
      path: "/api/profile/subscription",
      summary: "Update the current user's email-subscription status",
      body: SubscriptionPatchBody,
      responses: {
        200: SubscriptionPatchResponse,
        ...writeErrors,
        404: ApiErrorSchema,
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "VALIDATION_ERROR",
          "RATE_LIMITED",
          "NOT_FOUND",
          "SERVER_ERROR",
        ] as const,
      },
    },
    update: {
      method: "PATCH",
      path: "/api/profile/update",
      summary: "Update the current user's profile fields",
      body: UpdateBody,
      responses: { 200: UpdateResponse, ...writeErrors },
      metadata: { errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "RATE_LIMITED", "SERVER_ERROR"] as const },
    },
    visibilityGet: {
      method: "GET",
      path: "/api/profile/visibility",
      summary: "Get the current user's profile visibility flags",
      responses: { 200: VisibilityGetResponse, ...baseErrors, 429: RateLimitedErrorSchema },
      metadata: { errorCodes: ["UNAUTHORIZED", "RATE_LIMITED", "SERVER_ERROR"] as const },
    },
    visibilityPatch: {
      method: "PATCH",
      path: "/api/profile/visibility",
      summary: "Update the current user's profile visibility flags",
      body: VisibilityPatchBody,
      responses: { 200: VisibilityPatchResponse, ...writeErrors },
      metadata: { errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "RATE_LIMITED", "SERVER_ERROR"] as const },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
