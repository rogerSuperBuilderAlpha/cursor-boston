/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Notify-admin-area API contracts. Pure email-relay endpoints used by
 * public submission forms (CFP, talks, event requests). The author docs
 * are written by the client; these endpoints just forward to admin.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema } from "./common";

const c = initContract();

const PassthroughOk = z.object({}).passthrough();

const CfpBody = z
  .object({
    name: z.string().min(1),
    email: z.string().min(1),
    school: z.string().optional(),
    department: z.string().optional(),
    advisor: z.string().optional(),
    thesisTitle: z.string().min(1),
    abstract: z.string().optional(),
    userId: z.string().optional(),
  })
  .passthrough()
  .openapi("NotifyAdminCfpBody");

const EventBody = z
  .object({
    name: z.string().min(1),
    email: z.string().min(1),
    organization: z.string().optional(),
    eventType: z.string().optional(),
    title: z.string().min(1),
    description: z.string().optional(),
    proposedDate: z.string().optional(),
    expectedAttendees: z.string().optional(),
    venue: z.string().optional(),
    additionalInfo: z.string().optional(),
    requestId: z.string().optional(),
  })
  .passthrough()
  .openapi("NotifyAdminEventBody");

const TalkBody = z
  .object({
    name: z.string().min(1),
    email: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    category: z.string().optional(),
    duration: z.string().optional(),
    experience: z.string().optional(),
    bio: z.string().optional(),
    linkedIn: z.string().optional(),
    twitter: z.string().optional(),
    previousTalks: z.string().optional(),
    submissionId: z.string().optional(),
  })
  .passthrough()
  .openapi("NotifyAdminTalkBody");

const writeErrors = {
  400: ApiErrorSchema,
  500: ApiErrorSchema,
} as const;

export const notifyAdminContract = c.router(
  {
    cfp: {
      method: "POST",
      path: "/api/notify-admin/cfp",
      summary: "Email admin about a new CFP submission",
      body: CfpBody,
      responses: { 200: PassthroughOk, ...writeErrors },
      metadata: { errorCodes: ["VALIDATION_ERROR", "SERVER_ERROR"] as const },
    },
    event: {
      method: "POST",
      path: "/api/notify-admin/event",
      summary: "Email admin about a new event request",
      body: EventBody,
      responses: { 200: PassthroughOk, ...writeErrors },
      metadata: { errorCodes: ["VALIDATION_ERROR", "SERVER_ERROR"] as const },
    },
    talk: {
      method: "POST",
      path: "/api/notify-admin/talk",
      summary: "Email admin about a new talk submission",
      body: TalkBody,
      responses: { 200: PassthroughOk, ...writeErrors },
      metadata: { errorCodes: ["VALIDATION_ERROR", "SERVER_ERROR"] as const },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
