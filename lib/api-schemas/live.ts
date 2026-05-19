/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Live-sessions API contracts. Covers admin session creation, the emcee
 * control-deck actions, and audience speaker queueing for the lightning-
 * talks live view.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema } from "./common";

const c = initContract();

const baseErrors = {
  401: ApiErrorSchema.openapi({ description: "Authentication required" }),
  500: ApiErrorSchema,
} as const;
const writeErrors = {
  ...baseErrors,
  400: ApiErrorSchema.openapi({ description: "Validation error" }),
} as const;

// ──────────────────── Path / body schemas ────────────────────

const SessionIdParam = z.object({ sessionId: z.string().min(1) });

const SessionCreateBody = z
  .object({
    title: z.string().max(120).optional(),
  })
  .openapi("LiveSessionCreateBody");

const ControlActionEnum = z.enum([
  "start-next",
  "pause-timer",
  "resume-timer",
  "complete-current",
  "skip-current",
  "remove-entry",
  "move-entry",
  "end-session",
]);

const SessionControlBody = z
  .object({
    action: ControlActionEnum,
    entryId: z.string().optional(),
    targetIndex: z.number().int().optional(),
  })
  .openapi("LiveSessionControlBody");

const QueueJoinBody = z
  .object({
    talkTitle: z.string().min(1).max(140),
    durationMinutes: z.union([z.literal(3), z.literal(5)]),
  })
  .openapi("LiveSessionQueueJoinBody");

// ──────────────────── Response schemas ────────────────────

const SessionCreateResponse = z.object({
  sessionId: z.string(),
  title: z.string(),
  audiencePath: z.string(),
  emceePath: z.string(),
  status: z.string(),
});

const SessionControlResponse = z
  .object({
    status: z.string(),
    timerStatus: z.string(),
    currentSpeaker: z.unknown().nullable().optional(),
    historyRecord: z.object({}).passthrough().optional(),
  })
  .passthrough();

const QueueJoinResponse = z.object({
  entryId: z.string(),
  sessionId: z.string(),
  talkTitle: z.string(),
  durationMinutes: z.number(),
  status: z.string(),
});

// ──────────────────── Contract router ────────────────────

export const liveContract = c.router(
  {
    sessionCreate: {
      method: "POST",
      path: "/api/live/session",
      summary: "Admin: create a new live (lightning-talks) session",
      body: SessionCreateBody,
      responses: {
        200: SessionCreateResponse,
        ...writeErrors,
        403: ApiErrorSchema.openapi({ description: "Admin-only" }),
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
    sessionControl: {
      method: "POST",
      path: "/api/live/:sessionId/control",
      pathParams: SessionIdParam,
      summary: "Emcee control deck: drive the session forward",
      body: SessionControlBody,
      responses: {
        200: SessionControlResponse,
        ...writeErrors,
        403: ApiErrorSchema.openapi({ description: "Not the emcee for this session" }),
        404: ApiErrorSchema.openapi({ description: "Session not found" }),
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
    queueJoin: {
      method: "POST",
      path: "/api/live/:sessionId/queue",
      pathParams: SessionIdParam,
      summary: "Audience: join the speaker queue for a live session",
      body: QueueJoinBody,
      responses: {
        200: QueueJoinResponse,
        ...writeErrors,
        404: ApiErrorSchema.openapi({ description: "Session not found" }),
        409: ApiErrorSchema.openapi({
          description: "Session closed or speaker already queued",
        }),
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "VALIDATION_ERROR",
          "NOT_FOUND",
          "CONFLICT",
          "SERVER_ERROR",
        ] as const,
      },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
