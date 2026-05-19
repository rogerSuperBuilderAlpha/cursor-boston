/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Notifications-area API contracts. One-click HMAC-tokened unsubscribe
 * link sent in transactional emails.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const RedirectResponse = z.object({}).optional();

const UnsubscribeQuery = z.object({
  email: z.string().optional(),
  token: z.string().optional(),
});

export const notificationsContract = c.router(
  {
    unsubscribe: {
      method: "GET",
      path: "/api/notifications/unsubscribe",
      summary: "One-click email unsubscribe (HMAC token in query)",
      query: UnsubscribeQuery,
      responses: { 302: RedirectResponse },
      metadata: { errorCodes: [] as const },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
