/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Analytics-area API contracts. Public, cached aggregate stats served
 * from the `analytics_snapshots/latest` Firestore doc.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema, RateLimitedErrorSchema } from "./common";

const c = initContract();

const PassthroughOk = z
  .object({})
  .passthrough()
  .describe("AnalyticsSummary — see lib/analytics-snapshot-compute.ts");

export const analyticsContract = c.router(
  {
    summary: {
      method: "GET",
      path: "/api/analytics/summary",
      summary: "Public aggregate analytics summary (cached snapshot)",
      responses: {
        200: PassthroughOk,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["RATE_LIMITED", "SERVER_ERROR"] as const },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
