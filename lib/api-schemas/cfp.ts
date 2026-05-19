/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * CFP-area API contracts. Email-verification flow used to attach a
 * verified .edu address (and grant the eduBadge) to existing accounts.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema } from "./common";

const c = initContract();

const PassthroughOk = z.object({}).passthrough();

const SendEduCodeBody = z
  .object({
    email: z.string().min(1),
  })
  .openapi("CfpSendEduCodeBody");

const VerifyEduCodeBody = z
  .object({
    email: z.string().min(1),
    code: z.string().min(1),
  })
  .openapi("CfpVerifyEduCodeBody");

export const cfpContract = c.router(
  {
    sendEduCode: {
      method: "POST",
      path: "/api/cfp/send-edu-code",
      summary: "Send a 6-digit verification code to a .edu email",
      body: SendEduCodeBody,
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
    verifyEduCode: {
      method: "POST",
      path: "/api/cfp/verify-edu-code",
      summary: "Verify the .edu code and attach the email + eduBadge",
      body: VerifyEduCodeBody,
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
