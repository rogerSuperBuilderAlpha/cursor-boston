/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Pair-programming-area API contracts. Profile setup, top-match scoring,
 * and the request/response loop for live pairing sessions.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema } from "./common";

const c = initContract();

const PassthroughOk = z.object({}).passthrough();

const SessionTypeEnum = z.enum(
  ["teach-me", "build-together", "code-review", "explore-topic"],
  { errorMap: () => ({ message: "Invalid session type" }) }
);

const ProfilePostBody = z
  .object({
    skillsCanTeach: z
      .array(z.string({ invalid_type_error: "Invalid array items" }).max(500), {
        invalid_type_error: "Skills arrays must be present",
      })
      .max(20, "Array exceeds max length of 20"),
    skillsWantToLearn: z
      .array(z.string({ invalid_type_error: "Invalid array items" }).max(500), {
        invalid_type_error: "Skills arrays must be present",
      })
      .max(20, "Array exceeds max length of 20"),
    preferredLanguages: z
      .array(z.string({ invalid_type_error: "Invalid array items" }).max(500))
      .max(20, "Array exceeds max length of 20")
      .optional(),
    preferredFrameworks: z
      .array(z.string({ invalid_type_error: "Invalid array items" }).max(500))
      .max(20, "Array exceeds max length of 20")
      .optional(),
    timezone: z
      .string({ required_error: "Timezone is required" })
      .min(1, "Timezone is required"),
    availability: z.array(z.unknown()).optional(),
    sessionTypes: z
      .array(SessionTypeEnum)
      .min(1, "At least one session type is required"),
    bio: z.string().max(1000, "Bio must be at most 1000 characters").optional(),
    isActive: z.boolean().optional(),
  })
  .passthrough()
  .openapi("PairProfileBody");

const RequestQuery = z.object({
  type: z.enum(["sent", "received"]).optional(),
});

const RequestPostBody = z
  .object({
    toUserId: z
      .string({ required_error: "toUserId is required" })
      .min(1, "toUserId is required"),
    sessionType: SessionTypeEnum,
    message: z.string().min(1).max(1000),
    proposedTime: z.string().optional(),
  })
  .openapi("PairRequestBody");

const RespondBody = z
  .object({
    requestId: z
      .string({ required_error: "requestId is required" })
      .min(1, "requestId is required"),
    action: z.enum(["accept", "decline"]),
  })
  .openapi("PairRespondBody");

export const pairContract = c.router(
  {
    matches: {
      method: "GET",
      path: "/api/pair/matches",
      summary: "Get top pair-programming matches for the current user",
      responses: {
        200: PassthroughOk,
        401: ApiErrorSchema,
        404: ApiErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "NOT_FOUND", "SERVER_ERROR"] as const },
    },
    profileGet: {
      method: "GET",
      path: "/api/pair/profile",
      summary: "Get the current user's pair-programming profile",
      responses: { 200: PassthroughOk, 401: ApiErrorSchema, 500: ApiErrorSchema },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    profilePost: {
      method: "POST",
      path: "/api/pair/profile",
      summary: "Create or update the current user's pair-programming profile",
      body: ProfilePostBody,
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
    requestGet: {
      method: "GET",
      path: "/api/pair/request",
      summary: "List the current user's pair requests",
      query: RequestQuery,
      responses: { 200: PassthroughOk, 401: ApiErrorSchema, 500: ApiErrorSchema },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    requestPost: {
      method: "POST",
      path: "/api/pair/request",
      summary: "Send a pair request to another user",
      body: RequestPostBody,
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
    respond: {
      method: "POST",
      path: "/api/pair/respond",
      summary: "Accept or decline a received pair request",
      body: RespondBody,
      responses: {
        200: PassthroughOk,
        400: ApiErrorSchema,
        401: ApiErrorSchema,
        403: ApiErrorSchema,
        404: ApiErrorSchema,
        500: ApiErrorSchema,
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
  },
  { pathPrefix: "", strictStatusCodes: true }
);
