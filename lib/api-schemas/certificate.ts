/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Certificate-area API contracts. Issues a verifiable LinkedIn-ready
 * certificate when the caller crosses a merged-PR threshold.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema, RateLimitedErrorSchema } from "./common";

const c = initContract();

const PassthroughOk = z.object({}).passthrough();

export const certificateContract = c.router(
  {
    mine: {
      method: "GET",
      path: "/api/certificate/mine",
      summary: "List LinkedIn certificates issued to the signed-in user",
      responses: {
        200: PassthroughOk,
        401: ApiErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const,
      },
    },
    claim: {
      method: "POST",
      path: "/api/certificate/claim",
      summary: "Claim a Cursor Boston merged-PR certificate",
      body: z.object({}).optional(),
      responses: {
        200: PassthroughOk,
        400: ApiErrorSchema.openapi({ description: "GitHub not connected" }),
        401: ApiErrorSchema,
        403: ApiErrorSchema.openapi({ description: "Not enough merged PRs" }),
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "VALIDATION_ERROR",
          "RATE_LIMITED",
          "SERVER_ERROR",
        ] as const,
      },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
