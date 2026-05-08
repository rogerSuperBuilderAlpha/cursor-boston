/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Internal-area API contracts. Cron / job-runner endpoints authenticated
 * via `x-cron-secret` header (or `Authorization: Bearer`) — never via
 * Firebase Auth and never from user browsers.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema } from "./common";

const c = initContract();

const PassthroughOk = z.object({}).passthrough();

const CleanupQuery = z.object({
  batchSize: z.string().regex(/^\d+$/).optional(),
  maxBatches: z.string().regex(/^\d+$/).optional(),
  dryRun: z.enum(["true", "false"]).optional(),
});

const SnapshotsRebuildQuery = z.object({
  only: z.enum(["analytics", "members", "all"]).optional(),
  force: z.enum(["true", "false"]).optional(),
});

const cronErrors = {
  401: ApiErrorSchema.openapi({ description: "Missing or invalid cron secret" }),
  500: ApiErrorSchema,
} as const;

export const internalContract = c.router(
  {
    weeklyHiringPartnersDigestGet: {
      method: "GET",
      path: "/api/internal/digest/weekly-hiring-partners",
      summary: "Cron: weekly digest of pending hiring-partner applications",
      responses: { 200: PassthroughOk, ...cronErrors },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    weeklyHiringPartnersDigestPost: {
      method: "POST",
      path: "/api/internal/digest/weekly-hiring-partners",
      summary: "Cron: weekly digest of pending hiring-partner applications (POST form)",
      body: z.object({}).optional(),
      responses: { 200: PassthroughOk, ...cronErrors },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    huntEmailRetryGet: {
      method: "GET",
      path: "/api/internal/hunt/email-retry",
      summary: "Cron: retry undelivered treasure-hunt prize emails",
      responses: { 200: PassthroughOk, ...cronErrors },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    huntEmailRetryPost: {
      method: "POST",
      path: "/api/internal/hunt/email-retry",
      summary: "Cron: retry undelivered treasure-hunt prize emails (POST form)",
      body: z.object({}).optional(),
      responses: { 200: PassthroughOk, ...cronErrors },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    rateLimitsCleanup: {
      method: "POST",
      path: "/api/internal/rate-limits/cleanup",
      summary: "Cron: delete expired rate-limit docs in batches",
      query: CleanupQuery,
      body: z.object({}).optional(),
      responses: { 200: PassthroughOk, ...cronErrors },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    snapshotsRebuildGet: {
      method: "GET",
      path: "/api/internal/snapshots/rebuild",
      summary: "Cron: rebuild analytics + members snapshots",
      query: SnapshotsRebuildQuery,
      responses: { 200: PassthroughOk, ...cronErrors },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    snapshotsRebuildPost: {
      method: "POST",
      path: "/api/internal/snapshots/rebuild",
      summary: "Cron: rebuild analytics + members snapshots (POST form)",
      query: SnapshotsRebuildQuery,
      body: z.object({}).optional(),
      responses: { 200: PassthroughOk, ...cronErrors },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
