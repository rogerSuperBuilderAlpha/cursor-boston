/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Cursor-area API contracts. Covers connecting a user's Cursor API key and
 * launching Cursor-powered contribution idea runs.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema, RateLimitedErrorSchema } from "./common";

const c = initContract();

const CursorConnectBody = z
  .object({
    apiKey: z.string().min(1, "Cursor API key is required"),
    monthlyCapUsd: z.union([z.literal(0), z.literal(5), z.literal(25), z.literal(100)]),
  })
  .openapi("CursorConnectBody");

const CursorConnectResponse = z
  .object({
    ok: z.literal(true),
    fingerprint: z.string(),
    defaultModel: z.string().optional(),
  })
  .openapi("CursorConnectResponse");

const CursorDisconnectResponse = z
  .object({
    disconnected: z.literal(true),
  })
  .openapi("CursorDisconnectResponse");

const CursorIdeaRunStatusSchema = z
  .enum(["starting", "running", "finished", "error", "cancelled"])
  .openapi("CursorIdeaRunStatus");

const CursorIdeaWorkflowStageSchema = z
  .enum([
    "ideas",
    "questions",
    "planning",
    "plan_approval",
    "building",
    "ready_for_pr",
    "pr_open",
    "pr_commented_on",
    "pr_merged",
  ])
  .openapi("CursorIdeaWorkflowStage");

const CursorIdeaRunInputsSchema = z
  .object({
    mode: z.enum(["idea", "issue"]).optional(),
    interests: z.string().max(500).optional(),
    skills: z.string().max(500).optional(),
    preferredArea: z.string().max(160).optional(),
    constraints: z.string().max(500).optional(),
    freeform: z.string().max(2000).optional(),
    issueNumber: z.string().max(20).optional(),
    issueTitle: z.string().max(500).optional(),
    issueBody: z.string().max(4000).optional(),
    issueUrl: z.string().url().max(500).optional(),
    issueLabels: z.string().max(500).optional(),
  })
  .openapi("CursorIdeaRunInputs");

const CursorGithubIssueSchema = z
  .object({
    number: z.number().int().positive(),
    title: z.string(),
    url: z.string().url(),
    labels: z.array(z.string()),
    body: z.string().nullable(),
    comments: z.number().int().nonnegative(),
    updatedAt: z.string(),
  })
  .openapi("CursorGithubIssue");

const CursorGithubIssuesResponse = z
  .object({
    ok: z.literal(true),
    issues: z.array(CursorGithubIssueSchema),
  })
  .openapi("CursorGithubIssuesResponse");

const CursorIdeaRunArtifactSchema = z
  .object({
    path: z.string(),
    sizeBytes: z.number().int().nonnegative(),
    updatedAt: z.string(),
  })
  .openapi("CursorIdeaRunArtifact");

const CursorIdeaRunActivitySchema = z
  .object({
    id: z.string(),
    role: z.enum(["user", "assistant"]),
    summary: z.string(),
    kind: z.enum(["message", "thinking", "status", "tool", "shell"]).optional(),
  })
  .openapi("CursorIdeaRunActivity");

const CursorIdeaQuestionSchema = z
  .object({
    id: z.string(),
    question: z.string(),
    suggestions: z.array(z.string()).optional(),
    answer: z.string().optional(),
  })
  .openapi("CursorIdeaQuestion");

const CursorIdeaPrStateSchema = z
  .object({
    status: z.enum(["not_started", "opening", "pr_open", "pr_commented_on", "pr_merged"]),
    url: z.string().url().nullable().optional(),
    number: z.number().int().positive().nullable().optional(),
    openedAt: z.string().nullable().optional(),
    lastCommentedAt: z.string().nullable().optional(),
    mergedAt: z.string().nullable().optional(),
  })
  .openapi("CursorIdeaPrState");

const CursorIdeaRunSchema = z
  .object({
    id: z.string(),
    status: CursorIdeaRunStatusSchema,
    workflowStage: CursorIdeaWorkflowStageSchema.optional(),
    cursorAgentId: z.string().optional(),
    cursorRunId: z.string().optional(),
    cursorAgentUrl: z.string().url().optional(),
    questionRunId: z.string().optional(),
    planRunId: z.string().optional(),
    buildRunId: z.string().optional(),
    prRunId: z.string().optional(),
    prompt: z.string(),
    inputs: CursorIdeaRunInputsSchema,
    result: z.string().nullable().optional(),
    selectedIdea: z.string().nullable().optional(),
    questions: z.array(CursorIdeaQuestionSchema).optional(),
    answersSubmittedAt: z.string().nullable().optional(),
    buildPlan: z.string().nullable().optional(),
    buildResult: z.string().nullable().optional(),
    planApprovedAt: z.string().nullable().optional(),
    pr: CursorIdeaPrStateSchema.nullable().optional(),
    git: z.unknown().optional(),
    artifacts: z.array(CursorIdeaRunArtifactSchema).optional(),
    activity: z.array(CursorIdeaRunActivitySchema).optional(),
    cursorStatusDetail: z.string().nullable().optional(),
    cursorLastActivityAt: z.string().nullable().optional(),
    durationMs: z.number().nullable().optional(),
    error: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
    finishedAt: z.string().nullable().optional(),
    archivedAt: z.string().nullable().optional(),
  })
  .openapi("CursorIdeaRun");

const CursorIdeaRunLaunchResponse = z
  .object({
    ok: z.literal(true),
    run: CursorIdeaRunSchema,
  })
  .openapi("CursorIdeaRunLaunchResponse");

const CursorIdeaRunsListResponse = z
  .object({
    ok: z.literal(true),
    runs: z.array(CursorIdeaRunSchema),
  })
  .openapi("CursorIdeaRunsListResponse");

const CursorIdeaRunResponse = z
  .object({
    ok: z.literal(true),
    run: CursorIdeaRunSchema,
  })
  .openapi("CursorIdeaRunResponse");

const CursorIdeaRunDeleteResponse = z
  .object({
    deleted: z.literal(true),
  })
  .openapi("CursorIdeaRunDeleteResponse");

const CursorIdeaRunQuestionsBody = z
  .object({
    selectedIdea: z.string().min(1).max(4000),
  })
  .openapi("CursorIdeaRunQuestionsBody");

const CursorIdeaRunAnswersBody = z
  .object({
    answers: z.record(z.string().max(2000)),
  })
  .openapi("CursorIdeaRunAnswersBody");

export const cursorContract = c.router(
  {
    connect: {
      method: "POST",
      path: "/api/cursor/connect",
      summary: "Validate and store the current user's Cursor API key",
      body: CursorConnectBody,
      responses: {
        200: CursorConnectResponse,
        400: ApiErrorSchema,
        401: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    disconnect: {
      method: "POST",
      path: "/api/cursor/disconnect",
      summary: "Disconnect the current user's Cursor API key",
      body: z.object({}).optional(),
      responses: {
        200: CursorDisconnectResponse,
        401: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    launchIdeaRun: {
      method: "POST",
      path: "/api/cursor/idea-runs",
      summary: "Launch a Cursor Cloud Agent to propose contribution PR ideas",
      body: CursorIdeaRunInputsSchema,
      responses: {
        200: CursorIdeaRunLaunchResponse,
        202: CursorIdeaRunLaunchResponse,
        400: ApiErrorSchema,
        401: ApiErrorSchema,
        404: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "NOT_FOUND", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    listIdeaRuns: {
      method: "GET",
      path: "/api/cursor/idea-runs",
      summary: "List recent Cursor PR idea runs for the current user",
      query: z
        .object({
          refresh: z.enum(["true", "false"]).optional(),
        })
        .optional(),
      responses: {
        200: CursorIdeaRunsListResponse,
        401: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    listGithubIssues: {
      method: "GET",
      path: "/api/cursor/github-issues",
      summary: "List open GitHub issues for PR Studio",
      responses: {
        200: CursorGithubIssuesResponse,
        401: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    getIdeaRun: {
      method: "GET",
      path: "/api/cursor/idea-runs/:runId",
      summary: "Get and refresh a Cursor PR idea run",
      responses: {
        200: CursorIdeaRunResponse,
        401: ApiErrorSchema,
        404: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "NOT_FOUND", "SERVER_ERROR"] as const },
    },
    cancelIdeaRun: {
      method: "POST",
      path: "/api/cursor/idea-runs/:runId/cancel",
      summary: "Cancel an active Cursor PR idea run",
      body: z.object({}).optional(),
      responses: {
        200: CursorIdeaRunResponse,
        401: ApiErrorSchema,
        404: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "NOT_FOUND", "SERVER_ERROR"] as const },
    },
    archiveIdeaRun: {
      method: "POST",
      path: "/api/cursor/idea-runs/:runId/archive",
      summary: "Archive the Cursor agent behind an idea run",
      body: z.object({}).optional(),
      responses: {
        200: CursorIdeaRunResponse,
        401: ApiErrorSchema,
        404: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "NOT_FOUND", "SERVER_ERROR"] as const },
    },
    deleteIdeaRun: {
      method: "DELETE",
      path: "/api/cursor/idea-runs/:runId",
      summary: "Delete the Cursor agent and local record for an idea run",
      body: z.object({}).optional(),
      responses: {
        200: CursorIdeaRunDeleteResponse,
        401: ApiErrorSchema,
        404: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "NOT_FOUND", "SERVER_ERROR"] as const },
    },
    requestIdeaQuestions: {
      method: "POST",
      path: "/api/cursor/idea-runs/:runId/questions",
      summary: "Ask clarification questions for a selected Cursor PR idea",
      body: CursorIdeaRunQuestionsBody,
      responses: {
        200: CursorIdeaRunResponse,
        202: CursorIdeaRunResponse,
        400: ApiErrorSchema,
        401: ApiErrorSchema,
        404: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "NOT_FOUND", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    submitIdeaAnswers: {
      method: "POST",
      path: "/api/cursor/idea-runs/:runId/answers",
      summary: "Submit clarification answers and request a build plan",
      body: CursorIdeaRunAnswersBody,
      responses: {
        200: CursorIdeaRunResponse,
        202: CursorIdeaRunResponse,
        400: ApiErrorSchema,
        401: ApiErrorSchema,
        404: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "NOT_FOUND", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    approveIdeaPlan: {
      method: "POST",
      path: "/api/cursor/idea-runs/:runId/approve-plan",
      summary: "Approve the generated build plan and start implementation",
      body: z.object({}).optional(),
      responses: {
        200: CursorIdeaRunResponse,
        202: CursorIdeaRunResponse,
        400: ApiErrorSchema,
        401: ApiErrorSchema,
        404: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "NOT_FOUND", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    openIdeaPr: {
      method: "POST",
      path: "/api/cursor/idea-runs/:runId/open-pr",
      summary: "Open a pull request for a built Cursor idea run",
      body: z.object({}).optional(),
      responses: {
        200: CursorIdeaRunResponse,
        202: CursorIdeaRunResponse,
        400: ApiErrorSchema,
        401: ApiErrorSchema,
        404: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "NOT_FOUND", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    recoverIdeaAgent: {
      method: "POST",
      path: "/api/cursor/idea-runs/:runId/recover-agent",
      summary: "Start a fresh Cursor Cloud Agent from the current workflow context",
      body: z.object({}).optional(),
      responses: {
        200: CursorIdeaRunResponse,
        202: CursorIdeaRunResponse,
        400: ApiErrorSchema,
        401: ApiErrorSchema,
        404: ApiErrorSchema,
        409: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "NOT_FOUND", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
