/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { eventsContract } from "@/lib/api-schemas/events";
import {
  cancelEventRsvp,
  createEventRsvp,
  getEventRsvpSnapshot,
} from "@/lib/event-rsvp";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { sanitizeDocId } from "@/lib/sanitize";
import { getVerifiedUser } from "@/lib/server-auth";

// @contracts: eventsContract.rsvpGet, eventsContract.rsvpPost, eventsContract.rsvpDelete (lib/api-schemas/events.ts)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 20 };

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

function jsonSnapshot(
  payload: Awaited<ReturnType<typeof getEventRsvpSnapshot>>,
  extra: Record<string, unknown> = {}
) {
  if ("error" in payload) {
    return NextResponse.json({ error: payload.error }, { status: 400 });
  }
  return NextResponse.json({
    success: true,
    configured: payload.configured,
    ...payload.snapshot,
    ...extra,
  });
}

async function parseEventId(context: RouteContext): Promise<string | null> {
  const { eventId } = await context.params;
  return sanitizeDocId(eventId);
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`event-rsvp-get:${clientId}`, RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        {
          status: 429,
          headers: { "Retry-After": String(rateResult.retryAfter || 60) },
        }
      );
    }

    const eventId = await parseEventId(context);
    if (!eventId) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    const user = await getVerifiedUser(request);
    const payload = await getEventRsvpSnapshot(eventId, user?.uid ?? null);
    return jsonSnapshot(payload);
  } catch (error) {
    logger.logError(error, { endpoint: "/api/events/[eventId]/rsvp", area: "events" });
    return NextResponse.json({ error: "Failed to load RSVP status" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`event-rsvp-post:${clientId}`, RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        {
          status: 429,
          headers: { "Retry-After": String(rateResult.retryAfter || 60) },
        }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const eventId = await parseEventId(context);
    if (!eventId) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    let body: unknown = {};
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
      }
    }
    const parsed = eventsContract.rsvpPost.body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const payload = await createEventRsvp(eventId, user.uid);
    return jsonSnapshot(payload);
  } catch (error) {
    logger.logError(error, { endpoint: "/api/events/[eventId]/rsvp", area: "events" });
    return NextResponse.json({ error: "Failed to RSVP" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`event-rsvp-delete:${clientId}`, RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        {
          status: 429,
          headers: { "Retry-After": String(rateResult.retryAfter || 60) },
        }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const eventId = await parseEventId(context);
    if (!eventId) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    const payload = await cancelEventRsvp(eventId, user.uid);
    return jsonSnapshot(payload);
  } catch (error) {
    logger.logError(error, { endpoint: "/api/events/[eventId]/rsvp", area: "events" });
    return NextResponse.json({ error: "Failed to cancel RSVP" }, { status: 500 });
  }
}
