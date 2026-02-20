import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMMUNITY_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 10 };

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`community-post:${clientId}`, COMMUNITY_RATE_LIMIT);
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
      logger.error("Firebase Admin is not configured for posts");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const { content } = await request.json();

    const sanitizedContent = sanitizeText(typeof content === "string" ? content : "");
    if (sanitizedContent.length < 100 || sanitizedContent.length > 500) {
      return NextResponse.json(
        { error: "Content must be between 100 and 500 characters" },
        { status: 400 }
      );
    }

    const authorName =
      user.name || (user.email ? user.email.split("@")[0] : "Anonymous");

    const messageRef = db.collection("communityMessages").doc();
    await messageRef.set({
      content: sanitizedContent,
      authorId: user.uid,
      authorName,
      authorPhoto: user.picture || null,
      createdAt: FieldValue.serverTimestamp(),
      likeCount: 0,
      dislikeCount: 0,
      replyCount: 0,
      repostCount: 0,
    });

    return NextResponse.json({ messageId: messageRef.id });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/community/post" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
