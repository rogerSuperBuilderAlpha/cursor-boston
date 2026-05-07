/**
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

const SuccessTrue = z.object({ success: z.literal(true) });

const QuestionShape = z.object({}).passthrough().openapi("Question", {
  description:
    "Question document. Canonical type lives in `types/questions.ts`.",
});
const AnswerShape = z.object({}).passthrough().openapi("Answer");

const ListQuery = PaginationQuerySchema.extend({
  sort: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
});

const PostBody = z
  .object({
    title: z
      .string()
      .min(10, "Title must be at least 10 characters")
      .max(200, "Title must be at most 200 characters"),
    body: z
      .string()
      .min(20, "Body must be at least 20 characters")
      .max(5000, "Body must be at most 5000 characters"),
    tags: z.array(z.string()).max(10).optional(),
  })
  .openapi("QuestionsPostBody");

const AnswerBody = z
  .object({
    questionId: z.string().min(1),
    body: z
      .string()
      .min(20, "Answer must be at least 20 characters")
      .max(5000, "Answer must be at most 5000 characters"),
  })
  .openapi("QuestionsAnswerBody");

const AcceptBody = z
  .object({
    questionId: z.string().min(1),
    answerId: z.string().min(1),
  })
  .openapi("QuestionsAcceptBody");

const VoteBody = z
  .object({
    targetType: z.enum(["question", "answer"]),
    targetId: z.string().min(1),
    questionId: z.string().optional(),
    type: z.enum(["up", "down"]),
  })
  .openapi("QuestionsVoteBody");

const QuestionIdParam = z.object({ questionId: z.string().min(1) });

const QuestionsListResponse = z
  .object({ questions: z.array(QuestionShape) })
  .merge(PaginationFieldsSchema);

const QuestionDetailResponse = z.object({
  question: QuestionShape,
  answers: z.array(AnswerShape),
  relatedCookbook: z.array(z.object({}).passthrough()).optional(),
});

const VoteResultResponse = z.object({
  upvotes: z.number().int().nonnegative().optional(),
  downvotes: z.number().int().nonnegative().optional(),
  action: z.string().optional(),
});

const VoteListResponse = z.object({
  userVotes: z.record(z.string(), z.enum(["up", "down"]).nullable()),
});

export const questionsContract = c.router(
  {
    list: {
      method: "GET",
      path: "/api/questions",
      summary: "List questions with cursor pagination",
      query: ListQuery,
      responses: {
        200: QuestionsListResponse,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["RATE_LIMITED", "SERVER_ERROR"] as const },
    },
    detail: {
      method: "GET",
      path: "/api/questions/:questionId",
      pathParams: QuestionIdParam,
      summary: "Get question detail (with top answers + related cookbook entries)",
      responses: {
        200: QuestionDetailResponse,
        404: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["NOT_FOUND", "RATE_LIMITED", "SERVER_ERROR"] as const },
    },
    post: {
      method: "POST",
      path: "/api/questions/post",
      summary: "Create a new question",
      body: PostBody,
      responses: {
        201: z.object({ questionId: z.string() }),
        ...writeErrors,
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
    answer: {
      method: "POST",
      path: "/api/questions/answer",
      summary: "Post an answer on a question",
      body: AnswerBody,
      responses: {
        200: z.object({ answerId: z.string() }),
        ...writeErrors,
        404: ApiErrorSchema,
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
    accept: {
      method: "POST",
      path: "/api/questions/accept",
      summary: "Mark an answer as accepted (question owner only)",
      body: AcceptBody,
      responses: {
        200: SuccessTrue,
        ...writeErrors,
        403: ApiErrorSchema,
        404: ApiErrorSchema,
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "VALIDATION_ERROR",
          "RATE_LIMITED",
          "NOT_FOUND",
          "SERVER_ERROR",
        ] as const,
      },
    },
    vote: {
      method: "POST",
      path: "/api/questions/vote",
      summary: "Vote up/down on a question or answer",
      body: VoteBody,
      responses: {
        200: VoteResultResponse,
        ...writeErrors,
        404: ApiErrorSchema,
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
    myVotes: {
      method: "GET",
      path: "/api/questions/vote",
      summary: "Get the current user's votes (per target id)",
      responses: {
        200: VoteListResponse,
        ...baseErrors,
        429: RateLimitedErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "RATE_LIMITED", "SERVER_ERROR"] as const },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
