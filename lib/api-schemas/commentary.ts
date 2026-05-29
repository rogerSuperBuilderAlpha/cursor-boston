/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Commentary-area API contract. Backs the live "trash talk" sports
 * commentary demo (glaze / roast lines for a home vs. target team). The
 * endpoint is a mock generator — all request fields are optional and the
 * handler falls back to Celtics-vs-Knicks defaults.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema } from "./common";

const c = initContract();

export const CommentaryBody = z
  .object({
    event: z.string().optional(),
    homeTeam: z.string().optional(),
    targetTeam: z.string().optional(),
    mode: z.string().optional(),
    intensity: z.string().optional(),
    persona: z.string().optional(),
  })
  .passthrough()
  .openapi("CommentaryBody");

const CommentaryResponse = z
  .object({
    commentary: z.string(),
    sentiment: z.enum(["glaze", "roast"]),
    crowdEnergy: z.number(),
    event: z.string(),
    targetTeam: z.string(),
    persona: z.string(),
    intensity: z.string(),
    homeTeam: z.string(),
  })
  .openapi("CommentaryResponse");

export const commentaryContract = c.router(
  {
    generate: {
      method: "POST",
      path: "/api/commentary",
      summary: "Generate live glaze/roast sports commentary",
      body: CommentaryBody,
      responses: {
        200: CommentaryResponse,
        400: ApiErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["VALIDATION_ERROR", "SERVER_ERROR"] as const },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
