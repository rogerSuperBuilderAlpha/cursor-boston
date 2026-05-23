/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Skills Passport API contracts. The first implementation slice exposes a
 * signed-in, read-only progress projection derived from profile and badge data.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema, RateLimitedErrorSchema, REQUIRES_AUTH } from "./common";

const c = initContract();

const SkillLevelSchema = z.enum(["started", "practiced", "verified", "mentor"]);
const BadgeIdSchema = z.enum([
  "first-steps",
  "connected",
  "speaker",
  "hacker",
  "showcase-star",
  "conversation-starter",
  "regular",
  "mentor",
  "contributor",
]);

const SkillCatalogItemSchema = z.object({
  id: z.string(),
  trackId: z.string(),
  title: z.string(),
  description: z.string(),
  levels: z.array(SkillLevelSchema),
  evidenceRequirements: z.array(z.string()),
  relatedBadgeIds: z.array(BadgeIdSchema),
});

const SkillProgressItemSchema = z.object({
  skillId: z.string(),
  trackId: z.string(),
  title: z.string(),
  description: z.string(),
  level: SkillLevelSchema,
  progressPercent: z.number().int().min(0).max(100),
  relatedBadgeIds: z.array(BadgeIdSchema),
  earnedBadgeIds: z.array(BadgeIdSchema),
  evidenceRequirements: z.array(z.string()),
});

const BadgeDataStatusSchema = z.object({
  state: z.enum(["complete", "partial", "failed"]),
  isAuthoritative: z.boolean(),
  failedSources: z.array(z.string()),
  message: z.string().optional(),
});

const SkillsProgressResponse = z
  .object({
    catalog: z.array(SkillCatalogItemSchema),
    progress: z.array(SkillProgressItemSchema),
    summary: z.object({
      totalSkills: z.number().int().nonnegative(),
      practicedSkills: z.number().int().nonnegative(),
      verifiedSkills: z.number().int().nonnegative(),
      mentorSkills: z.number().int().nonnegative(),
      averageProgressPercent: z.number().int().min(0).max(100),
    }),
    badgeDataStatus: BadgeDataStatusSchema,
  })
  .openapi("SkillsProgressResponse");

export const skillsContract = c.router(
  {
    progress: {
      method: "GET",
      path: "/api/skills/progress",
      summary: "Get the current user's Skills Passport progress",
      responses: {
        200: SkillsProgressResponse,
        401: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        security: REQUIRES_AUTH,
        errorCodes: ["UNAUTHORIZED", "RATE_LIMITED", "SERVER_ERROR"] as const,
      },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
