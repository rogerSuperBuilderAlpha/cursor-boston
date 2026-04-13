/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { addSubscriber, removeSubscriber } from "@/lib/tip-subscribers";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";
import { apiSuccess, apiError } from "@/lib/api-response";
import { withRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function postHandler(request: Request) {
  try {
    const body = await request.json();
    const { email, name } = body;

    if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      return apiError("A valid email address is required", 400);
    }

    await addSubscriber(email.trim(), name?.trim?.());
    return apiSuccess({ message: "Subscribed to weekly tips" }, 201);
  } catch (error) {
    logger.logError(error, { endpoint: "/api/tips/subscribe POST" });
    return apiError("Internal server error", 500);
  }
}

async function deleteHandler(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const token = searchParams.get("token");

    if (!email || !token) {
      return apiError("Email and token are required", 400);
    }

    if (!verifyUnsubscribeToken(email, token)) {
      return apiError("Invalid unsubscribe token", 403);
    }

    await removeSubscriber(email);
    return apiSuccess({ message: "Unsubscribed from weekly tips" });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/tips/subscribe DELETE" });
    return apiError("Internal server error", 500);
  }
}

export const POST = withRateLimit(rateLimitConfigs.standard, postHandler);
export const DELETE = withRateLimit(rateLimitConfigs.standard, deleteHandler);
