/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Treasure-hunt-area API contracts. Multiple discovery paths (oracle,
 * konami sequence, …) each verify a per-day token and award a Cursor
 * credit prize from the shared pool.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema, RateLimitedErrorSchema } from "./common";

const c = initContract();

const PassthroughOk = z.object({}).passthrough();

const PathIdParam = z.object({ pathId: z.string().min(1) });

const SubmitBody = z
  .object({
    answer: z.string().min(1),
  })
  .openapi("HuntPathSubmitBody");

export const huntContract = c.router(
  {
    status: {
      method: "GET",
      path: "/api/hunt/status",
      summary: "Caller eligibility + remaining-prize counts",
      responses: {
        200: PassthroughOk,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["SERVER_ERROR"] as const },
    },
    oracle: {
      method: "GET",
      path: "/api/hunt/oracle",
      summary: "Daily oracle riddle + answer fingerprint",
      responses: { 200: PassthroughOk },
      metadata: { errorCodes: [] as const },
    },
    oracleKonami: {
      method: "GET",
      path: "/api/hunt/oracle/konami",
      summary: "Daily Konami token (only revealed with X-Konami-Sequence header)",
      responses: {
        200: PassthroughOk,
        404: ApiErrorSchema,
      },
      metadata: { errorCodes: ["NOT_FOUND"] as const },
    },
    pathSubmit: {
      method: "POST",
      path: "/api/hunt/paths/:pathId/submit",
      pathParams: PathIdParam,
      summary: "Submit a candidate answer for a hunt path",
      body: SubmitBody,
      responses: {
        200: PassthroughOk,
        400: ApiErrorSchema,
        401: ApiErrorSchema,
        403: ApiErrorSchema,
        404: ApiErrorSchema,
        409: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "NOT_FOUND",
          "VALIDATION_ERROR",
          "CONFLICT",
          "RATE_LIMITED",
          "SERVER_ERROR",
        ] as const,
      },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
