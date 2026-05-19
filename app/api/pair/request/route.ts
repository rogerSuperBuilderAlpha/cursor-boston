/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  createPairRequestServer,
  getPairRequestsForUserServer,
} from "@/lib/pair-programming/data-server";
import { parseRequestBody } from "@/lib/api-response";
import { pairContract } from "@/lib/api-schemas/pair";

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

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;
    const parsed = pairContract.requestPost.body.safeParse(bodyOrError);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }
    const { toUserId, sessionType, message, proposedTime } = parsed.data;

    if (message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
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
