/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Discord-area API contracts. OAuth-only — both routes are 302 redirects
 * driven by query strings supplied by Discord and our own returnTo cookie.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema } from "./common";

const c = initContract();

const RedirectResponse = z.object({}).optional();

const AuthorizeQuery = z.object({
  returnTo: z.string().optional(),
});

const CallbackQuery = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
});

export const discordContract = c.router(
  {
    authorize: {
      method: "GET",
      path: "/api/discord/authorize",
      summary: "Begin Discord OAuth — redirects to discord.com",
      query: AuthorizeQuery,
      responses: { 302: RedirectResponse, 500: ApiErrorSchema },
      metadata: { errorCodes: ["SERVER_ERROR"] as const },
    },
    callback: {
      method: "GET",
      path: "/api/discord/callback",
      summary: "Discord OAuth callback — finishes the link and redirects",
      query: CallbackQuery,
      responses: { 302: RedirectResponse, 429: ApiErrorSchema },
      metadata: { errorCodes: ["RATE_LIMITED"] as const },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
