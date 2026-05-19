/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Talks API contracts. Currently covers admin moderation of talk
 * submissions (approve / mark complete) and the paginated queue read.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  ApiErrorSchema,
  PaginationFieldsSchema,
  PaginationQuerySchema,
  RateLimitedErrorSchema,
} from "./common";

const c = initContract();

const baseErrors = {
  401: ApiErrorSchema.openapi({ description: "Authentication required" }),
  500: ApiErrorSchema,
} as const;
const adminErrors = {
  ...baseErrors,
  400: ApiErrorSchema.openapi({ description: "Validation error" }),
  403: ApiErrorSchema.openapi({ description: "Admin-only" }),
  429: RateLimitedErrorSchema.openapi({ description: "Rate limit exceeded" }),
  503: ApiErrorSchema.openapi({ description: "Rate limit service unavailable" }),
} as const;

// ──────────────────── Body / query schemas ────────────────────

const ModerateQuery = PaginationQuerySchema.extend({
  status: z
    .enum(["pending", "approved", "completed"])
    .optional()
    .describe("Single-status paginated mode; omit to get all three buckets"),
}).openapi("TalkSubmissionModerateQuery");

const ModerateBody = z
  .object({
    submissionId: z.string().min(1),
    action: z.enum(["approve", "complete"]).optional(),
  })
  .openapi("TalkSubmissionModerateBody");

// ──────────────────── Response schemas ────────────────────

const TalkSubmissionRow = z
  .object({
    submissionId: z.string(),
    userId: z.string(),
    title: z.string(),
    status: z.string(),
    createdAt: z.string().optional(),
  })
  .passthrough();

const ModerateListResponse = z
  .object({
    talkSubmissions: z.array(TalkSubmissionRow),
  })
  .merge(PaginationFieldsSchema);

const ModerateActionResponse = z
  .object({
    approved: z.boolean(),
    submissionId: z.string(),
    status: z.string(),
    alreadyApproved: z.boolean().optional(),
    alreadyCompleted: z.boolean().optional(),
  })
  .passthrough();

// ──────────────────── Contract router ────────────────────

export const talksContract = c.router(
  {
    submissionModerateList: {
      method: "GET",
      path: "/api/talks/submission/moderate",
      summary: "Admin: list talk submissions (paginated by status, or three-bucket default)",
      query: ModerateQuery,
      responses: { 200: ModerateListResponse, ...adminErrors },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "RATE_LIMITED",
          "SERVER_ERROR",
        ] as const,
      },
    },
    submissionModerateAction: {
      method: "POST",
      path: "/api/talks/submission/moderate",
      summary: "Admin: approve a talk submission or mark it delivered",
      body: ModerateBody,
      responses: {
        200: ModerateActionResponse,
        ...adminErrors,
        404: ApiErrorSchema.openapi({ description: "Submission not found" }),
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "NOT_FOUND",
          "VALIDATION_ERROR",
          "RATE_LIMITED",
          "SERVER_ERROR",
        ] as const,
      },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
