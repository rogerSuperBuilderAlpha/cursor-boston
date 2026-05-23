/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Monthly challenge API contracts. The first implementation slice supports
 * signed-in member submissions for an open challenge.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema, RateLimitedErrorSchema } from "./common";

const c = initContract();

const CreateSubmissionBody = z
  .object({
    title: z.string().min(3).max(120),
    summary: z.string().min(20).max(500),
    repositoryUrl: z.string().url().optional(),
    demoUrl: z.string().url().optional(),
    writeup: z.string().min(50).max(4000),
    cursorWorkflow: z.string().min(20).max(2000),
    submitNow: z.boolean().optional(),
  })
  .openapi("MonthlyChallengeCreateSubmissionBody");

const SubmissionResponseSchema = z
  .object({
    id: z.string(),
    challengeId: z.string(),
    ownerUid: z.string(),
    title: z.string(),
    summary: z.string(),
    repositoryUrl: z.string().optional(),
    demoUrl: z.string().optional(),
    writeup: z.string(),
    cursorWorkflow: z.string(),
    status: z.enum(["draft", "submitted"]),
    createdAt: z.string(),
    updatedAt: z.string(),
    submittedAt: z.string().optional(),
  })
  .openapi("MonthlyChallengeSubmissionResponse");

const CreateSubmissionResponse = z
  .object({
    ok: z.literal(true),
    submission: SubmissionResponseSchema,
  })
  .openapi("MonthlyChallengeCreateSubmissionResponse");

export const monthlyChallengesContract = c.router(
  {
    createSubmission: {
      method: "POST",
      path: "/api/challenges/:challengeId/submissions",
      summary: "Create a monthly challenge submission draft or submitted entry",
      pathParams: z.object({ challengeId: z.string().min(1) }),
      body: CreateSubmissionBody,
      responses: {
        201: CreateSubmissionResponse,
        400: ApiErrorSchema.openapi({ description: "Validation error" }),
        401: ApiErrorSchema.openapi({ description: "Authentication required" }),
        404: ApiErrorSchema.openapi({ description: "Challenge not found" }),
        409: ApiErrorSchema.openapi({ description: "Challenge is not accepting submissions" }),
        429: RateLimitedErrorSchema.openapi({ description: "Rate limit exceeded" }),
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "VALIDATION_ERROR",
          "NOT_FOUND",
          "CONFLICT",
          "RATE_LIMITED",
          "SERVER_ERROR",
        ] as const,
      },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
