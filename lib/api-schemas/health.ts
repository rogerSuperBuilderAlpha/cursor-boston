/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Health-area API contracts. Simple liveness probe used by container
 * orchestrators and uptime monitoring.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const HealthResponse = z
  .object({
    status: z.literal("healthy"),
    timestamp: z.string(),
    version: z.string(),
  })
  .openapi("HealthCheckResponse");

export const healthContract = c.router(
  {
    check: {
      method: "GET",
      path: "/api/health",
      summary: "Liveness probe (always 200 if the app is up)",
      responses: { 200: HealthResponse },
      metadata: { errorCodes: [] as const },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
