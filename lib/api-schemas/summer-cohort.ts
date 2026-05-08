/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Summer-cohort-area API contracts. Application intake, post-admission
 * intake survey, public submission feeds, and per-week voting.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema } from "./common";

const c = initContract();

const PassthroughOk = z.object({}).passthrough();

const ApplyBody = z
  .object({
    name: z.string().min(1).max(200),
    phone: z.string().min(1).max(50),
    cohorts: z.array(z.string()).min(1),
    isLocal: z.boolean(),
    wantsToPresent: z.boolean(),
  })
  .passthrough()
  .openapi("SummerCohortApplyBody");

const IntakeSurveyBody = z
  .object({})
  .passthrough()
  .openapi("SummerCohortIntakeSurveyBody");

const WeekIdParam = z.object({ weekId: z.string().min(1) });

const VotesQuery = z.object({
  weekId: z.enum(["week-1", "week-2", "week-3"]),
});

const VotesPostBody = z
  .object({
    weekId: z.enum(["week-1", "week-2", "week-3"]),
    submitterHandle: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-zA-Z0-9_-]+$/),
  })
  .openapi("SummerCohortVoteBody");

export const summerCohortContract = c.router(
  {
    applyGet: {
      method: "GET",
      path: "/api/summer-cohort/apply",
      summary: "Get the current user's summer-cohort application + counts",
      responses: { 200: PassthroughOk, 401: ApiErrorSchema, 500: ApiErrorSchema },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    applyPost: {
      method: "POST",
      path: "/api/summer-cohort/apply",
      summary: "Create or update the current user's summer-cohort application",
      body: ApplyBody,
      responses: {
        200: PassthroughOk,
        400: ApiErrorSchema,
        401: ApiErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    applyDelete: {
      method: "DELETE",
      path: "/api/summer-cohort/apply",
      summary: "Withdraw the current user's summer-cohort application",
      body: z.object({}).optional(),
      responses: { 200: PassthroughOk, 401: ApiErrorSchema, 500: ApiErrorSchema },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    intakeSurveyGet: {
      method: "GET",
      path: "/api/summer-cohort/intake-survey",
      summary: "Get the current user's intake-survey response",
      responses: { 200: PassthroughOk, 401: ApiErrorSchema, 500: ApiErrorSchema },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    intakeSurveyPost: {
      method: "POST",
      path: "/api/summer-cohort/intake-survey",
      summary: "Submit (or re-submit) the intake survey",
      body: IntakeSurveyBody,
      responses: {
        200: PassthroughOk,
        400: ApiErrorSchema,
        401: ApiErrorSchema,
        403: ApiErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "VALIDATION_ERROR",
          "SERVER_ERROR",
        ] as const,
      },
    },
    submissionsByWeek: {
      method: "GET",
      path: "/api/summer-cohort/submissions/:weekId",
      pathParams: WeekIdParam,
      summary: "Public read of merged submissions on a vote-format week",
      responses: { 200: PassthroughOk, 404: ApiErrorSchema },
      metadata: { errorCodes: ["NOT_FOUND"] as const },
    },
    votesGet: {
      method: "GET",
      path: "/api/summer-cohort/votes",
      summary: "Aggregate vote counts for a vote-format week",
      query: VotesQuery,
      responses: {
        200: PassthroughOk,
        400: ApiErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["VALIDATION_ERROR", "SERVER_ERROR"] as const },
    },
    votesPost: {
      method: "POST",
      path: "/api/summer-cohort/votes",
      summary: "Toggle the current user's vote for a submission",
      body: VotesPostBody,
      responses: {
        200: PassthroughOk,
        400: ApiErrorSchema,
        401: ApiErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
