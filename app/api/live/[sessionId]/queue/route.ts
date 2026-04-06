import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { sanitizeText } from "@/lib/sanitize";
import {
  enqueueSpeakerServer,
  LiveSessionClosedError,
  LiveSessionDuplicateSpeakerError,
  LiveSessionNotFoundError,
} from "@/lib/live-sessions/data-server";
import {
  LIVE_TALK_DURATIONS,
  type LiveTalkDurationMinutes,
} from "@/lib/live-sessions/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TALK_TITLE_LENGTH = 140;

function normalizeTalkTitle(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const sanitized = sanitizeText(value);
  if (!sanitized || sanitized.length > MAX_TALK_TITLE_LENGTH) {
    return null;
  }

  return sanitized;
}

function normalizeDuration(value: unknown): LiveTalkDurationMinutes | null {
  if (typeof value !== "number") {
    return null;
  }

  return LIVE_TALK_DURATIONS.includes(value as LiveTalkDurationMinutes)
    ? (value as LiveTalkDurationMinutes)
    : null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await context.params;
    if (!sessionId?.trim()) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    let body: {
      talkTitle?: unknown;
      durationMinutes?: unknown;
    };
    try {
      body = (await request.json()) as {
        talkTitle?: unknown;
        durationMinutes?: unknown;
      };
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    const talkTitle = normalizeTalkTitle(body.talkTitle);
    const durationMinutes = normalizeDuration(body.durationMinutes);

    if (!talkTitle) {
      return NextResponse.json(
        { error: `Talk title must be a string up to ${MAX_TALK_TITLE_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (!durationMinutes) {
      return NextResponse.json(
        { error: `Duration must be one of: ${LIVE_TALK_DURATIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const speakerName =
      typeof user.name === "string" && user.name.trim()
        ? user.name.trim()
        : typeof user.email === "string" && user.email.trim()
        ? user.email.trim()
        : "Speaker";

    const entry = await enqueueSpeakerServer({
      sessionId: sessionId.trim(),
      userId: user.uid,
      speakerName,
      speakerPhotoUrl: user.picture ?? null,
      talkTitle,
      durationMinutes,
    });

    return NextResponse.json({
      entryId: entry.id,
      sessionId: entry.sessionId,
      talkTitle: entry.talkTitle,
      durationMinutes: entry.durationMinutes,
      status: entry.status,
    });
  } catch (error) {
    if (error instanceof LiveSessionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof LiveSessionClosedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof LiveSessionDuplicateSpeakerError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error("Error joining live queue:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
