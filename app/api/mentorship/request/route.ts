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
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { mentorshipContract } from "@/lib/api-schemas/mentorship";

const RATE_LIMIT = { windowMs: 60 * 60 * 1000, maxRequests: 5 } as const;

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

    const rl = await checkUpstashRateLimit(`mentorship-request:${user.uid}`, RATE_LIMIT);
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: "Too many mentorship requests. Try again later." },
        { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined }
      );
    }

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;
    const parsed = mentorshipContract.requestPost.body.safeParse(bodyOrError);
    if (!parsed.success) {
      // Preserve the consent-specific error message that downstream tests
      // and UI strings rely on.
      const consentIssue = parsed.error.issues.find(
        (issue) => issue.path[0] === "consentToShareProfile"
      );
      if (consentIssue) {
        return NextResponse.json(
          {
            success: false,
            error:
              "consentToShareProfile must be true. Sending a mentorship request shares your profile fields with the recipient.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }
    const { toUserId, goals, message } = parsed.data;

    if (toUserId === user.uid) {
      return NextResponse.json(
        { success: false, error: "Cannot send request to yourself" },
        { status: 400 }
      );
    }

    if (!goals.every((g: string) => g.trim().length > 0)) {
      return NextResponse.json(
        { success: false, error: "Each goal must be a non-empty string under 200 characters" },
        { status: 400 }
      );
    }

    if (message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
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
