/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Mentorship-area API contracts. Profile setup, top-match scoring,
 * and the mentor↔mentee request/response loop.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema, RateLimitedErrorSchema } from "./common";

const c = initContract();

const PassthroughOk = z.object({}).passthrough();

const ProfilePostBody = z
  .object({
    role: z.enum(["mentor", "mentee", "both"]),
    expertise: z.array(z.string().max(200)).max(20).optional(),
    learningGoals: z.array(z.string().max(200)).max(20).optional(),
    preferredLanguages: z.array(z.string().max(200)).max(20).optional(),
    timezone: z.string().min(1),
    availability: z.array(z.unknown()).optional(),
    bio: z.string().max(1000).optional(),
    maxMentees: z.number().int().min(1).max(10).optional(),
    isActive: z.boolean().optional(),
  })
  .passthrough()
  .openapi("MentorshipProfileBody");

const RequestPostBody = z
  .object({
    toUserId: z.string().min(1),
    goals: z.array(z.string().min(1).max(200)).min(1).max(10),
    message: z.string().min(1).max(1000),
    consentToShareProfile: z.literal(true),
  })
  .openapi("MentorshipRequestBody");

const RequestQuery = z.object({
  type: z.enum(["sent", "received"]).optional(),
});

const RespondBody = z
  .object({
    requestId: z.string().min(1),
    action: z.enum(["accept", "decline"]),
  })
  .openapi("MentorshipRespondBody");

export const mentorshipContract = c.router(
  {
    matches: {
      method: "GET",
      path: "/api/mentorship/matches",
      summary: "Get top mentor/mentee matches for the current user",
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
      path: "/api/mentorship/profile",
      summary: "Get the current user's mentorship profile",
      responses: {
        200: PassthroughOk,
        401: ApiErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    profilePost: {
      method: "POST",
      path: "/api/mentorship/profile",
      summary: "Create or update the current user's mentorship profile",
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
      path: "/api/mentorship/request",
      summary: "List the current user's mentorship requests",
      query: RequestQuery,
      responses: {
        200: PassthroughOk,
        401: ApiErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    requestPost: {
      method: "POST",
      path: "/api/mentorship/request",
      summary: "Send a mentorship request to another user",
      body: RequestPostBody,
      responses: {
        200: PassthroughOk,
        400: ApiErrorSchema,
        401: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "VALIDATION_ERROR",
          "RATE_LIMITED",
          "SERVER_ERROR",
        ] as const,
      },
    },
    respond: {
      method: "POST",
      path: "/api/mentorship/respond",
      summary: "Accept or decline a received mentorship request",
      body: RespondBody,
      responses: {
        200: PassthroughOk,
        400: ApiErrorSchema,
        401: ApiErrorSchema,
        403: ApiErrorSchema,
        404: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
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
