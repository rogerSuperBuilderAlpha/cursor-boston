/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Hiring-partners-area API contracts. Per-user company application doc
 * keyed by uid. GET reads the current state; POST upserts.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema } from "./common";

const c = initContract();

const PassthroughOk = z.object({}).passthrough();

// All fields are accepted as `unknown` so the route's `trimOrEmpty`
// helper can coerce non-string values (numbers, objects, arrays) into
// empty strings without surfacing a 400 to the user. Type contracts here
// describe shape only; the route owns sanitization.
const ApplyBody = z
  .object({
    contactName: z.unknown().optional(),
    phone: z.unknown().optional(),
    companyName: z.unknown().optional(),
    companyWebsite: z.unknown().optional(),
    contactRole: z.unknown().optional(),
    rolesHiring: z.unknown().optional(),
    notes: z.unknown().optional(),
    engineerExpectations: z.record(z.unknown()).optional(),
    engineerRequirements: z.unknown().optional(),
  })
  .passthrough()
  .openapi("HiringPartnerApplyBody");

export const hiringPartnersContract = c.router(
  {
    applyGet: {
      method: "GET",
      path: "/api/hiring-partners/apply",
      summary: "Get the current user's hiring-partner application",
      responses: {
        200: PassthroughOk,
        401: ApiErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    applyPost: {
      method: "POST",
      path: "/api/hiring-partners/apply",
      summary: "Create or update the current user's hiring-partner application",
      body: ApplyBody,
      responses: {
        200: PassthroughOk,
        400: ApiErrorSchema,
        401: ApiErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
