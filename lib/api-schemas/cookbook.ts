/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Cookbook API contracts. The cookbook surface lets users submit prompts,
 * vote on them, and browse the paginated entry list with category /
 * worksWith filters. Heavy aggregate responses use `passthrough()`; inputs
 * are strictly validated.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  ApiErrorSchema,
  PaginationFieldsSchema,
  PaginationQuerySchema,
  RateLimitedErrorSchema,
} from "./common";

const c = initContract();

const baseErrors = {
  401: ApiErrorSchema.openapi({ description: "Authentication required" }),
  500: ApiErrorSchema,
} as const;
const writeErrors = {
  ...baseErrors,
  400: ApiErrorSchema.openapi({ description: "Validation error" }),
  429: RateLimitedErrorSchema.openapi({ description: "Rate limit exceeded" }),
} as const;

// ──────────────────── Body / query schemas ────────────────────

const EntriesQuery = PaginationQuerySchema.extend({
  category: z.string().optional().describe("Cookbook category filter"),
  worksWith: z.string().optional().describe("Tool/language tag filter"),
  search: z.string().optional().describe("Free-text search across title/description/tags"),
  sort: z
    .enum(["newest", "oldest", "top"])
    .optional()
    .describe("Sort mode; defaults to 'newest' (or when search is set)"),
}).openapi("CookbookEntriesQuery");

const CreateEntryBody = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    promptContent: z.string().min(1).max(10000),
    category: z.string().optional(),
    tags: z.array(z.string()).max(10).optional(),
    worksWith: z.array(z.string()).optional(),
  })
  .openapi("CookbookCreateEntryBody");

const VoteBody = z
  .object({
    entryId: z.string().min(1),
    type: z.enum(["up", "down"]),
  })
  .openapi("CookbookVoteBody");

// ──────────────────── Response schemas ────────────────────

const CookbookEntryRowSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    promptContent: z.string(),
    category: z.string(),
    tags: z.array(z.string()),
    worksWith: z.array(z.string()),
    authorId: z.string(),
    authorDisplayName: z.string(),
    createdAt: z.string(),
    upCount: z.number().int().nonnegative(),
    downCount: z.number().int().nonnegative(),
  })
  .passthrough()
  .openapi("CookbookEntryRow");

const EntriesListResponse = z
  .object({ entries: z.array(CookbookEntryRowSchema) })
  .merge(PaginationFieldsSchema)
  .openapi("CookbookEntriesListResponse");

const CreateEntryResponse = CookbookEntryRowSchema;

const VoteResponse = z
  .object({
    action: z.enum(["added", "removed", "switched"]),
    type: z.enum(["up", "down"]),
    previousType: z.enum(["up", "down"]).optional(),
    upCount: z.number().int().nonnegative(),
    downCount: z.number().int().nonnegative(),
  })
  .openapi("CookbookVoteResponse");

const VoteListResponse = z
  .object({
    userVotes: z.record(z.string(), z.string()),
  })
  .openapi("CookbookUserVotesResponse");

// ──────────────────── Contract router ────────────────────

export const cookbookContract = c.router(
  {
    entries: {
      method: "GET",
      path: "/api/cookbook/entries",
      summary: "List cookbook entries (paginated, filterable, searchable)",
      query: EntriesQuery,
      responses: { 200: EntriesListResponse, 500: ApiErrorSchema },
      metadata: { errorCodes: ["SERVER_ERROR"] as const },
    },
    createEntry: {
      method: "POST",
      path: "/api/cookbook/entries",
      summary: "Submit a new cookbook entry",
      body: CreateEntryBody,
      responses: { 200: CreateEntryResponse, ...writeErrors },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "VALIDATION_ERROR",
          "RATE_LIMITED",
          "SERVER_ERROR",
        ] as const,
      },
    },
    vote: {
      method: "POST",
      path: "/api/cookbook/vote",
      summary: "Up- or down-vote a cookbook entry (toggle / switch supported)",
      body: VoteBody,
      responses: {
        200: VoteResponse,
        ...writeErrors,
        404: ApiErrorSchema.openapi({ description: "Entry not found" }),
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "VALIDATION_ERROR",
          "RATE_LIMITED",
          "NOT_FOUND",
          "SERVER_ERROR",
        ] as const,
      },
    },
    voteList: {
      method: "GET",
      path: "/api/cookbook/vote",
      summary: "Get the current user's vote map across all cookbook entries",
      responses: { 200: VoteListResponse },
      metadata: { errorCodes: [] as const },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
