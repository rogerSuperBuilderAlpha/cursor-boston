/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Prompt template API contracts. The first implementation slice supports
 * signed-in member submissions as private drafts or pending-review templates.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  ApiErrorSchema,
  RateLimitedErrorSchema,
} from "./common";

const c = initContract();

const PlaceholderSchema = z
  .object({
    name: z.string().regex(/^[a-z][a-z0-9_]{1,48}$/),
    label: z.string().min(1).max(80),
    description: z.string().min(1).max(240),
    required: z.boolean(),
    example: z.string().min(1).max(160),
  })
  .openapi("PromptTemplatePlaceholder");

const CreateTemplateBody = z
  .object({
    title: z.string().min(3).max(120),
    summary: z.string().min(10).max(500),
    category: z.string().min(2).max(64),
    useCase: z.string().min(2).max(120).optional(),
    prompt: z.string().min(20).max(8000),
    placeholders: z.array(PlaceholderSchema).max(20).optional(),
    tags: z.array(z.string().min(1).max(40)).max(10).optional(),
    submitForReview: z.boolean().optional(),
  })
  .openapi("PromptTemplateCreateBody");

const TemplateResponseSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    ownerUid: z.string(),
    title: z.string(),
    summary: z.string(),
    category: z.string(),
    useCase: z.string(),
    prompt: z.string(),
    placeholders: z.array(PlaceholderSchema),
    tags: z.array(z.string()),
    moderationStatus: z.enum(["draft", "pending_review"]),
    visibility: z.literal("private"),
    voteScore: z.number().int(),
    variantCount: z.number().int().nonnegative(),
    forkCount: z.number().int().nonnegative(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("PromptTemplateResponse");

const CreateTemplateResponse = z
  .object({
    ok: z.literal(true),
    template: TemplateResponseSchema,
  })
  .openapi("PromptTemplateCreateResponse");

export const promptTemplatesContract = c.router(
  {
    createTemplate: {
      method: "POST",
      path: "/api/templates",
      summary: "Create a private prompt template draft or pending-review template",
      body: CreateTemplateBody,
      responses: {
        201: CreateTemplateResponse,
        400: ApiErrorSchema.openapi({ description: "Validation error" }),
        401: ApiErrorSchema.openapi({ description: "Authentication required" }),
        429: RateLimitedErrorSchema.openapi({ description: "Rate limit exceeded" }),
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
  },
  { pathPrefix: "", strictStatusCodes: true }
);
