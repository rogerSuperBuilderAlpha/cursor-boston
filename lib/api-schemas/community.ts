/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
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
const moderationErrors = {
  ...writeErrors,
  403: ApiErrorSchema.openapi({ description: "Forbidden" }),
  404: ApiErrorSchema.openapi({ description: "Not found" }),
} as const;

const SuccessTrue = z.object({ success: z.literal(true) });

// ──────────────────── Body schemas ────────────────────

const PostBody = z
  .object({
    content: z
      .string()
      .min(100, "Content must be between 100 and 500 characters")
      .max(500, "Content must be between 100 and 500 characters"),
  })
  .openapi("CommunityPostBody", {
    example: {
      content:
        "Just shipped a Cursor workflow that pipes diff output through Claude before commit — drops typos and lazy variable names way faster than a linter. Anyone else doing pre-commit AI review?",
    },
  });

const ReplyBody = z
  .object({
    parentId: z.string().min(1),
    content: z.string().min(100).max(500),
  })
  .openapi("CommunityReplyBody");

const RepostBody = z
  .object({
    originalId: z.string().min(1),
    content: z.string().min(100).max(500),
  })
  .openapi("CommunityRepostBody");

const ReactionBody = z
  .object({
    messageId: z.string().min(1),
    type: z.enum(["like", "dislike"]),
  })
  .openapi("CommunityReactionBody");

const DeleteBody = z
  .object({ messageId: z.string().min(1) })
  .openapi("CommunityDeleteBody");

const BlockBody = z
  .object({ targetUid: z.string().min(1) })
  .openapi("CommunityBlockBody");

const ReportBody = z
  .object({
    targetMessageId: z.string().min(1),
    reason: z.enum(["spam", "harassment", "hate", "self-harm", "other"]),
    notes: z.string().optional(),
  })
  .openapi("CommunityReportBody");

const ModeratePostBody = z
  .object({
    reportId: z.string().min(1),
    action: z.enum(["dismiss", "hide", "suspend"]),
  })
  .openapi("CommunityModerateBody");

const MyReactionsQuery = z.object({
  messageIds: z
    .string()
    .min(1)
    .describe("Comma-separated message ids, up to 60"),
});

const ModerateQuery = PaginationQuerySchema.extend({
  status: z.string().optional().describe("Filter status; default 'open', or 'all'"),
});

// ──────────────────── Response schemas ────────────────────

const CreatePostResponse = z
  .object({ messageId: z.string() })
  .openapi("CommunityCreatePostResponse");

const CreateReplyResponse = z.object({ replyId: z.string() });
const CreateRepostResponse = z.object({ repostId: z.string() });

const ReactionResponse = z.object({
  action: z.enum(["added", "removed", "switched"]),
  type: z.enum(["like", "dislike"]).optional(),
  previousType: z.enum(["like", "dislike"]).optional(),
});

const ReportResponse = z.object({
  success: z.literal(true),
  reportId: z.string(),
});

const ModerateListResponse = z
  .object({ reports: z.array(z.object({}).passthrough()) })
  .merge(PaginationFieldsSchema);

const ModerateActionResponse = z.object({
  success: z.literal(true),
  action: z.string(),
  reportId: z.string(),
});

const MyReactionsResponse = z.object({
  reactions: z.record(z.string(), z.enum(["like", "dislike"])),
});

// ──────────────────── Contract ────────────────────

export const communityContract = c.router(
  {
    createPost: {
      method: "POST",
      path: "/api/community/post",
      summary: "Create a community post",
      description:
        "Creates a top-level post in the community feed. Authentication required. Rate-limited to 10 requests per minute per client.",
      body: PostBody,
      responses: { 200: CreatePostResponse, ...writeErrors },
      metadata: {
        errorCodes: [
          "VALIDATION_ERROR",
          "UNAUTHORIZED",
          "RATE_LIMITED",
          "SERVER_ERROR",
          "NOT_CONFIGURED",
        ] as const,
      },
    },
    createReply: {
      method: "POST",
      path: "/api/community/reply",
      summary: "Reply to a community post",
      body: ReplyBody,
      responses: { 200: CreateReplyResponse, ...writeErrors, 404: ApiErrorSchema },
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
    createRepost: {
      method: "POST",
      path: "/api/community/repost",
      summary: "Repost a community message with optional commentary",
      body: RepostBody,
      responses: { 200: CreateRepostResponse, ...writeErrors, 404: ApiErrorSchema },
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
    reaction: {
      method: "POST",
      path: "/api/community/reaction",
      summary: "Add / remove / switch a like or dislike on a message",
      body: ReactionBody,
      responses: { 200: ReactionResponse, ...writeErrors, 404: ApiErrorSchema },
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
    myReactions: {
      method: "GET",
      path: "/api/community/my-reactions",
      summary: "Get the current user's reactions for a batch of messages",
      query: MyReactionsQuery,
      responses: { 200: MyReactionsResponse, ...baseErrors },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    deletePost: {
      method: "POST",
      path: "/api/community/delete",
      summary: "Delete the current user's own community message",
      body: DeleteBody,
      responses: { 200: SuccessTrue, ...moderationErrors },
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
    block: {
      method: "POST",
      path: "/api/community/block",
      summary: "Block another user",
      body: BlockBody,
      responses: { 200: SuccessTrue, ...writeErrors },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "VALIDATION_ERROR",
          "RATE_LIMITED",
          "SERVER_ERROR",
        ] as const,
      },
    },
    unblock: {
      method: "DELETE",
      path: "/api/community/block",
      summary: "Unblock another user",
      query: z.object({ targetUid: z.string().min(1) }),
      responses: { 200: SuccessTrue, ...writeErrors },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "VALIDATION_ERROR",
          "RATE_LIMITED",
          "SERVER_ERROR",
        ] as const,
      },
    },
    report: {
      method: "POST",
      path: "/api/community/report",
      summary: "Report a message for moderation",
      body: ReportBody,
      responses: { 200: ReportResponse, ...writeErrors, 404: ApiErrorSchema },
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
    moderateList: {
      method: "GET",
      path: "/api/community/moderate",
      summary: "Admin: list community reports (paginated)",
      query: ModerateQuery,
      responses: { 200: ModerateListResponse, ...moderationErrors },
      metadata: { errorCodes: ["UNAUTHORIZED", "FORBIDDEN", "SERVER_ERROR"] as const },
    },
    moderateAction: {
      method: "POST",
      path: "/api/community/moderate",
      summary: "Admin: act on a community report (dismiss / hide / suspend)",
      body: ModeratePostBody,
      responses: { 200: ModerateActionResponse, ...moderationErrors },
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
