/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Maintainers-area API contracts. Self-service status check + the
 * maintainer review queue (gated on a merged maintainer-application PR).
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema, RateLimitedErrorSchema } from "./common";

const c = initContract();

const PassthroughOk = z.object({}).passthrough();

export const maintainersContract = c.router(
  {
    status: {
      method: "GET",
      path: "/api/maintainers/status",
      summary: "Get the current user's maintainer eligibility",
      responses: {
        200: PassthroughOk,
        401: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "RATE_LIMITED", "SERVER_ERROR"] as const },
    },
    reviewQueue: {
      method: "GET",
      path: "/api/maintainers/review-queue",
      summary: "Get the open-PR review queue for the current maintainer",
      responses: {
        200: PassthroughOk,
        401: ApiErrorSchema,
        403: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "FORBIDDEN", "RATE_LIMITED", "SERVER_ERROR"] as const,
      },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
