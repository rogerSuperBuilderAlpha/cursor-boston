import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { respondToPairRequestServer } from "@/lib/pair-programming/data-server";

/**
 * POST /api/pair/respond
 * Accept or decline a pair programming request (uses transaction to prevent races)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { requestId, action } = body;

    if (!requestId || typeof requestId !== "string") {
      return NextResponse.json(
        { success: false, error: "requestId is required" },
        { status: 400 }
      );
    }

    if (action !== "accept" && action !== "decline") {
      return NextResponse.json(
        { success: false, error: "Action must be 'accept' or 'decline'" },
        { status: 400 }
      );
    }

    const result = await respondToPairRequestServer(requestId, user.uid, action);

    return NextResponse.json({
      success: true,
      status: result.status,
      sessionId: result.sessionId,
      message: action === "accept" ? "Request accepted - session created" : "Request declined",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to respond to request";

    if (message === "Request not found") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    if (message === "Unauthorized") {
      return NextResponse.json(
        { success: false, error: "You can only respond to requests sent to you" },
        { status: 403 }
      );
    }
    if (message === "Request has already been responded to") {
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    console.error("Error responding to pair request:", error);
    return NextResponse.json(
      { success: false, error: "Failed to respond to request" },
      { status: 500 }
    );
  }
}
