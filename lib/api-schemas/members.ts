/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Members-area API contracts. Public, cached snapshot of opted-in
 * community members.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema } from "./common";

const c = initContract();

const PassthroughOk = z
  .object({})
  .passthrough()
  .describe("PublicMember[] — see types/members.ts");

export const membersContract = c.router(
  {
    publicList: {
      method: "GET",
      path: "/api/members/public",
      summary: "Public, cached community members directory",
      responses: {
        200: PassthroughOk,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["SERVER_ERROR"] as const },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
