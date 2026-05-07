/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema, RateLimitedErrorSchema } from "./common";

const c = initContract();

const CreatePostBodySchema = z
  .object({
    content: z
      .string()
      .min(100, "Content must be between 100 and 500 characters")
      .max(500, "Content must be between 100 and 500 characters")
      .describe("Post body. Sanitized server-side before storage."),
  })
  .openapi("CommunityCreatePostBody", {
    example: {
      content:
        "Just shipped a Cursor workflow that pipes diff output through Claude before commit — drops typos and lazy variable names way faster than a linter. Anyone else doing pre-commit AI review?",
    },
  });

const CreatePostResponseSchema = z
  .object({
    messageId: z
      .string()
      .describe("Firestore document id for the new message"),
  })
  .openapi("CommunityCreatePostResponse", {
    example: { messageId: "FxLk9aZqpQrTqVwR" },
  });

export const communityContract = c.router(
  {
    createPost: {
      method: "POST",
      path: "/api/community/post",
      summary: "Create a community post",
      description:
        "Creates a top-level post in the community feed. Authentication required. Rate-limited to 10 requests per minute per client.",
      body: CreatePostBodySchema,
      responses: {
        200: CreatePostResponseSchema,
        400: ApiErrorSchema.openapi({
          description: "Validation error (content length out of range)",
        }),
        401: ApiErrorSchema.openapi({
          description: "Missing or invalid auth credentials",
        }),
        429: RateLimitedErrorSchema.openapi({
          description: "Rate limit exceeded",
        }),
        500: ApiErrorSchema,
      },
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
  },
  {
    pathPrefix: "",
    strictStatusCodes: true,
  }
);
