import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  createPairRequestServer,
  getPairRequestsForUserServer,
} from "@/lib/pair-programming/data-server";
import type { SessionType } from "@/lib/pair-programming/types";

const VALID_SESSION_TYPES: SessionType[] = [
  "teach-me",
  "build-together",
  "code-review",
  "explore-topic",
];

const MAX_MESSAGE_LENGTH = 1000;

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
    const type = searchParams.get("type") === "sent" ? "sent" : "received";

    const requests = await getPairRequestsForUserServer(user.uid, type);

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

    if (!toUserId || typeof toUserId !== "string") {
      return NextResponse.json(
        { success: false, error: "toUserId is required" },
        { status: 400 }
      );
    }

    if (!sessionType || !VALID_SESSION_TYPES.includes(sessionType)) {
      return NextResponse.json(
        { success: false, error: "Invalid session type" },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (toUserId === user.uid) {
      return NextResponse.json(
        { success: false, error: "Cannot send request to yourself" },
        { status: 400 }
      );
    }

    if (proposedTime) {
      const parsedTime = new Date(proposedTime);
      if (isNaN(parsedTime.getTime())) {
        return NextResponse.json(
          { success: false, error: "Invalid proposed time format" },
          { status: 400 }
        );
      }
      if (parsedTime.getTime() < Date.now()) {
        return NextResponse.json(
          { success: false, error: "Proposed time must be in the future" },
          { status: 400 }
        );
      }
    }

    const requestId = await createPairRequestServer({
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
