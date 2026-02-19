import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  updatePairRequestStatus,
  getPairRequestsForUser,
  createPairSession,
} from "@/lib/pair-programming/data";
import { getAdminDb } from "@/lib/firebase-admin";
import type { RequestStatus } from "@/lib/pair-programming/types";

/**
 * POST /api/pair/respond
 * Accept or decline a pair programming request
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

    if (!requestId || !action) {
      return NextResponse.json(
        { success: false, error: "requestId and action are required" },
        { status: 400 }
      );
    }

    if (action !== "accept" && action !== "decline") {
      return NextResponse.json(
        { success: false, error: "Action must be 'accept' or 'decline'" },
        { status: 400 }
      );
    }

    // Get the request to verify ownership
    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: "Database not available" },
        { status: 500 }
      );
    }

    const requestDoc = await adminDb
      .collection("pair_requests")
      .doc(requestId)
      .get();

    if (!requestDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Request not found" },
        { status: 404 }
      );
    }

    const requestData = requestDoc.data();
    if (requestData?.toUserId !== user.uid) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - you can only respond to requests sent to you" },
        { status: 403 }
      );
    }

    if (requestData?.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "Request has already been responded to" },
        { status: 400 }
      );
    }

    const newStatus: RequestStatus = action === "accept" ? "accepted" : "declined";
    await updatePairRequestStatus(requestId, newStatus);

    // If accepted, create a pair session
    let sessionId: string | undefined;
    if (action === "accept") {
      sessionId = await createPairSession({
        participantIds: [requestData.fromUserId, user.uid],
        sessionType: requestData.sessionType,
        status: "scheduled",
        scheduledTime: requestData.proposedTime || undefined,
      });
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      sessionId,
      message: action === "accept" ? "Request accepted - session created" : "Request declined",
    });
  } catch (error) {
    console.error("Error responding to pair request:", error);
    return NextResponse.json(
      { success: false, error: "Failed to respond to request" },
      { status: 500 }
    );
  }
}
