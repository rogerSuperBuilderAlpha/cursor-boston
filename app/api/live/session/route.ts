/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { sanitizeText } from "@/lib/sanitize";
import { createLiveSessionServer } from "@/lib/live-sessions/data-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_SESSION_TITLE = "Lightning Talks";
const MAX_TITLE_LENGTH = 120;

function normalizeSessionTitle(value: unknown): string | null {
  if (value == null || value === "") {
    return DEFAULT_SESSION_TITLE;
  }

  if (typeof value !== "string") {
    return null;
  }

  const sanitized = sanitizeText(value);
  if (!sanitized) {
    return DEFAULT_SESSION_TITLE;
  }

  if (sanitized.length > MAX_TITLE_LENGTH) {
    return null;
  }

  return sanitized;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { title?: unknown };
    try {
      body = (await request.json()) as { title?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    const title = normalizeSessionTitle(body.title);

    if (!title) {
      return NextResponse.json(
        { error: `Title must be a string up to ${MAX_TITLE_LENGTH} characters` },
        { status: 400 }
      );
    }

    const emceeName =
      typeof user.name === "string" && user.name.trim()
        ? user.name.trim()
        : typeof user.email === "string" && user.email.trim()
        ? user.email.trim()
        : "Emcee";

    const { sessionId, session } = await createLiveSessionServer({
      title,
      emceeUid: user.uid,
      emceeName,
    });

    return NextResponse.json({
      sessionId,
      title: session.title,
      audiencePath: session.audiencePath,
      emceePath: session.emceePath,
      status: session.status,
    });
  } catch (error) {
    console.error("Error creating live session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
