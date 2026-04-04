import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  controlLiveSessionServer,
  LiveSessionInvalidActionError,
  LiveSessionNotFoundError,
  LiveSessionUnauthorizedError,
} from "@/lib/live-sessions/data-server";
import type { LiveSessionControlAction } from "@/lib/live-sessions/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ACTIONS: LiveSessionControlAction[] = [
  "start-next",
  "pause-timer",
  "resume-timer",
  "complete-current",
  "skip-current",
  "remove-entry",
  "move-entry",
  "end-session",
];

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
    const body = (await request.json().catch(() => ({}))) as {
      action?: unknown;
      entryId?: unknown;
      targetIndex?: unknown;
    };

    if (!VALID_ACTIONS.includes(body.action as LiveSessionControlAction)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const result = await controlLiveSessionServer({
      sessionId,
      emceeUid: user.uid,
      action: body.action as LiveSessionControlAction,
      entryId: typeof body.entryId === "string" ? body.entryId : undefined,
      targetIndex: typeof body.targetIndex === "number" ? body.targetIndex : undefined,
    });

    return NextResponse.json({
      status: result.session.status,
      timerStatus: result.session.timer.status,
      currentSpeaker: result.session.currentSpeaker,
      historyRecord: result.historyRecord,
    });
  } catch (error) {
    if (error instanceof LiveSessionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof LiveSessionUnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof LiveSessionInvalidActionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Error controlling live session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
