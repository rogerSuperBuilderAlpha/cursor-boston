/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  createMentorshipRequestServer,
  getMentorshipRequestsForUserServer,
} from "@/lib/mentorship/data-server";
import { parseRequestBody } from "@/lib/api-response";

const MAX_MESSAGE_LENGTH = 1000;
const MAX_GOALS = 10;
const MAX_GOAL_LENGTH = 200;

/**
 * GET /api/mentorship/request
 * Get mentorship requests for the authenticated user (?type=sent|received)
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

    const requests = await getMentorshipRequestsForUserServer(user.uid, type);
    return NextResponse.json({ success: true, requests });
  } catch (error) {
    console.error("Error fetching mentorship requests:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mentorship/request
 * Send a mentorship request to another user
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

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;
    const { toUserId, goals, message } = bodyOrError;

    if (!toUserId || typeof toUserId !== "string") {
      return NextResponse.json(
        { success: false, error: "toUserId is required" },
        { status: 400 }
      );
    }

    if (toUserId === user.uid) {
      return NextResponse.json(
        { success: false, error: "Cannot send request to yourself" },
        { status: 400 }
      );
    }

    if (!Array.isArray(goals) || goals.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one goal is required" },
        { status: 400 }
      );
    }

    if (goals.length > MAX_GOALS) {
      return NextResponse.json(
        { success: false, error: `Cannot specify more than ${MAX_GOALS} goals` },
        { status: 400 }
      );
    }

    if (!goals.every((g: unknown) => typeof g === "string" && g.trim().length > 0 && g.length <= MAX_GOAL_LENGTH)) {
      return NextResponse.json(
        { success: false, error: `Each goal must be a non-empty string under ${MAX_GOAL_LENGTH} characters` },
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

    const requestId = await createMentorshipRequestServer({
      fromUserId: user.uid,
      toUserId,
      goals: goals.map((g: string) => g.trim()),
      message: message.trim(),
    });

    return NextResponse.json({
      success: true,
      requestId,
      message: "Mentorship request sent successfully",
    });
  } catch (error) {
    console.error("Error creating mentorship request:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create request" },
      { status: 500 }
    );
  }
}
