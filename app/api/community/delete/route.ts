import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { sanitizeDocId } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMMUNITY_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 20 };

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`community-delete:${clientId}`, COMMUNITY_RATE_LIMIT);
    if (!rateResult.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rateResult.retryAfter },
        { status: 429, headers: { "Retry-After": String(rateResult.retryAfter || 60) } }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    if (!db) {
      logger.error("Firebase Admin is not configured for deletes");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const { messageId } = await request.json();

    const sanitizedId = sanitizeDocId(messageId);
    if (!sanitizedId) {
      return NextResponse.json({ error: "Invalid messageId format" }, { status: 400 });
    }

    const messageRef = db.collection("communityMessages").doc(sanitizedId);
    const messageSnap = await messageRef.get();

    if (!messageSnap.exists) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const messageData = messageSnap.data();
    if (messageData?.authorId !== user.uid) {
      return NextResponse.json({ error: "Not authorized to delete this message" }, { status: 403 });
    }

    await messageRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/community/delete" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
