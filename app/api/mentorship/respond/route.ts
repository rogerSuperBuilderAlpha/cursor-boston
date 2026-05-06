/**
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

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;
    const { requestId, action } = bodyOrError;

    if (!requestId || typeof requestId !== "string") {
      return NextResponse.json(
        { success: false, error: "requestId is required" },
        { status: 400 }
      );
    }

    if (action !== "accept" && action !== "decline") {
      return NextResponse.json(
        { success: false, error: "action must be 'accept' or 'decline'" },
        { status: 400 }
      );
    }

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
