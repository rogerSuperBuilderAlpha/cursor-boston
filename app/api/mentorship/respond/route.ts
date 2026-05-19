/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  respondToMentorshipRequestServer,
  MentorshipRequestNotFoundError,
  MentorshipRequestUnauthorizedError,
  MentorshipRequestAlreadyRespondedError,
} from "@/lib/mentorship/data-server";
import { parseRequestBody } from "@/lib/api-response";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { mentorshipContract } from "@/lib/api-schemas/mentorship";

const RESPOND_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 10 };

/**
 * POST /api/mentorship/respond
 * Accept or decline a mentorship request (uses Firestore transaction to prevent races)
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

    const rl = await checkUpstashRateLimit(`mentorship-respond:${user.uid}`, RESPOND_RATE_LIMIT);
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: "Too many responses. Try again shortly." },
        { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined }
      );
    }

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;
    const parsed = mentorshipContract.respond.body.safeParse(bodyOrError);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }
    const { requestId, action } = parsed.data;

    const result = await respondToMentorshipRequestServer(requestId, user.uid, action);

    return NextResponse.json({
      success: true,
      status: result.status,
      pairingId: result.pairingId,
      message: action === "accept" ? "Request accepted — pairing created" : "Request declined",
    });
  } catch (error) {
    if (error instanceof MentorshipRequestNotFoundError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    if (error instanceof MentorshipRequestUnauthorizedError) {
      return NextResponse.json(
        { success: false, error: "You can only respond to requests sent to you" },
        { status: 403 }
      );
    }
    if (error instanceof MentorshipRequestAlreadyRespondedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    console.error("Error responding to mentorship request:", error);
    return NextResponse.json(
      { success: false, error: "Failed to respond to request" },
      { status: 500 }
    );
  }
}
