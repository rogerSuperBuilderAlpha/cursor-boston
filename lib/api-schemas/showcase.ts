/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Showcase API contracts. Covers user submission (claim a curated project),
 * admin approval queue, and per-project upvote/downvote ledger.
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
const adminWriteErrors = {
  ...writeErrors,
  403: ApiErrorSchema.openapi({ description: "Admin-only" }),
} as const;

// ──────────────────── Body / query schemas ────────────────────

const SubmissionCreateBody = z
  .object({
    projectId: z.string().min(1),
  })
  .openapi("ShowcaseSubmissionCreateBody");

const SubmissionApproveBody = z
  .object({
    submissionId: z.string().min(1),
    action: z.enum(["approve", "reject"]).optional(),
    reason: z.string().max(500).optional(),
  })
  .openapi("ShowcaseSubmissionApproveBody");

const VoteBody = z
  .object({
    projectId: z.string().min(1),
    type: z.enum(["up", "down"]),
  })
  .openapi("ShowcaseVoteBody");

const VoteListQuery = z
  .object({
    limit: z
      .string()
      .regex(/^\d+$/)
      .optional()
      .describe("Page size; default 50, max 200"),
    startAfter: z.string().optional().describe("Cursor doc id (showcase project id)"),
  })
  .openapi("ShowcaseVoteListQuery");

// ──────────────────── Response schemas ────────────────────

const SubmissionStatusEnum = z.enum(["pending", "approved", "rejected"]);

const SubmissionListResponse = z.object({
  submissions: z.array(
    z.object({
      projectId: z.string(),
      status: SubmissionStatusEnum,
    })
  ),
});

const SubmissionCreateResponse = z
  .object({
    created: z.boolean(),
    resubmitted: z.boolean().optional(),
    projectId: z.string(),
    status: SubmissionStatusEnum,
  })
  .passthrough();

const PendingSubmissionsResponse = z.object({
  pendingSubmissions: z.array(
    z
      .object({
        submissionId: z.string(),
        userId: z.string(),
        projectId: z.string(),
        createdAt: z.string().optional(),
        resubmittedAt: z.string().optional(),
      })
      .passthrough()
  ),
});

const SubmissionApproveResponse = z
  .object({
    approved: z.boolean(),
    rejected: z.boolean().optional(),
    alreadyApproved: z.boolean().optional(),
    submissionId: z.string(),
    status: z.string(),
  })
  .passthrough();

const VoteResponse = z
  .object({
    action: z.enum(["added", "removed", "switched"]),
    type: z.enum(["up", "down"]),
    previousType: z.enum(["up", "down"]).optional(),
    upCount: z.number().int().nonnegative(),
    downCount: z.number().int().nonnegative(),
  })
  .openapi("ShowcaseVoteResponse");

const VoteListResponse = z.object({
  votes: z.record(
    z.string(),
    z.object({
      upCount: z.number().int().nonnegative(),
      downCount: z.number().int().nonnegative(),
    })
  ),
  userVotes: z.record(z.string(), z.string()),
});

// ──────────────────── Contract router ────────────────────

export const showcaseContract = c.router(
  {
    submissionList: {
      method: "GET",
      path: "/api/showcase/submission",
      summary: "Get the current user's showcase submissions",
      responses: {
        200: SubmissionListResponse,
        ...baseErrors,
        429: RateLimitedErrorSchema,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "RATE_LIMITED", "SERVER_ERROR"] as const,
      },
    },
    submissionCreate: {
      method: "POST",
      path: "/api/showcase/submission",
      summary: "Submit a curated showcase project for moderation",
      body: SubmissionCreateBody,
      responses: {
        200: SubmissionCreateResponse,
        ...writeErrors,
        404: ApiErrorSchema.openapi({ description: "Project not found" }),
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
    submissionPendingList: {
      method: "GET",
      path: "/api/showcase/submission/approve",
      summary: "Admin: list pending showcase submissions",
      responses: {
        200: PendingSubmissionsResponse,
        ...adminWriteErrors,
        503: ApiErrorSchema.openapi({ description: "Rate limit service unavailable" }),
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "RATE_LIMITED",
          "SERVER_ERROR",
        ] as const,
      },
    },
    submissionApprove: {
      method: "POST",
      path: "/api/showcase/submission/approve",
      summary: "Admin: approve or reject a showcase submission",
      body: SubmissionApproveBody,
      responses: {
        200: SubmissionApproveResponse,
        ...adminWriteErrors,
        404: ApiErrorSchema.openapi({ description: "Submission not found" }),
        503: ApiErrorSchema.openapi({ description: "Rate limit service unavailable" }),
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "NOT_FOUND",
          "VALIDATION_ERROR",
          "SERVER_ERROR",
        ] as const,
      },
    },
    vote: {
      method: "POST",
      path: "/api/showcase/vote",
      summary: "Vote on a showcase project (toggle / switch supported)",
      body: VoteBody,
      responses: { 200: VoteResponse, ...writeErrors },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "VALIDATION_ERROR",
          "RATE_LIMITED",
          "SERVER_ERROR",
        ] as const,
      },
    },
    voteList: {
      method: "GET",
      path: "/api/showcase/vote",
      summary: "Get aggregate showcase project vote counts (paginated) and user's ledger",
      query: VoteListQuery,
      responses: { 200: VoteListResponse },
      metadata: { errorCodes: [] as const },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
