import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { createPairRequest, getPairRequestsForUser } from "@/lib/pair-programming/data";
import type { SessionType } from "@/lib/pair-programming/types";

/**
 * GET /api/pair/request
 * Get pair requests for the authenticated user (sent and received)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("type") || "received") as "sent" | "received";

    const requests = await getPairRequestsForUser(user.uid, type);

    return NextResponse.json({
      success: true,
      requests,
    });
  } catch (error) {
    console.error("Error fetching pair requests:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pair/request
 * Create a new pair programming request
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
    const { toUserId, sessionType, message, proposedTime } = body;

    if (!toUserId || !sessionType || !message) {
      return NextResponse.json(
        { success: false, error: "toUserId, sessionType, and message are required" },
        { status: 400 }
      );
    }

    if (toUserId === user.uid) {
      return NextResponse.json(
        { success: false, error: "Cannot send request to yourself" },
        { status: 400 }
      );
    }

    const validSessionTypes: SessionType[] = [
      "teach-me",
      "build-together",
      "code-review",
      "explore-topic",
    ];
    if (!validSessionTypes.includes(sessionType)) {
      return NextResponse.json(
        { success: false, error: "Invalid session type" },
        { status: 400 }
      );
    }

    const requestId = await createPairRequest({
      fromUserId: user.uid,
      toUserId,
      sessionType,
      message: message.trim(),
      proposedTime: proposedTime ? new Date(proposedTime) : undefined,
    });

    return NextResponse.json({
      success: true,
      requestId,
      message: "Pair request sent successfully",
    });
  } catch (error) {
    console.error("Error creating pair request:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create request" },
      { status: 500 }
    );
  }
}
