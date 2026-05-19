/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Badges-area API contracts. Definitions are static config; awards are
 * recomputed per user via POST.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema, RateLimitedErrorSchema } from "./common";

const c = initContract();

const PassthroughOk = z.object({}).passthrough();

export const badgesContract = c.router(
  {
    definitions: {
      method: "GET",
      path: "/api/badges/definitions",
      summary: "Public list of badge definitions",
      responses: {
        200: PassthroughOk,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["SERVER_ERROR"] as const },
    },
    awards: {
      method: "POST",
      path: "/api/badges/awards",
      summary: "Recompute and persist badge awards for the current user",
      body: z.object({}).optional(),
      responses: {
        200: PassthroughOk,
        401: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "RATE_LIMITED", "SERVER_ERROR"] as const },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
