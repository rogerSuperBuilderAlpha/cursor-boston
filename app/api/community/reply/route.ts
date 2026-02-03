import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { sanitizeText, sanitizeDocId } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMMUNITY_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 20 };

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`community-reply:${clientId}`, COMMUNITY_RATE_LIMIT);
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
      logger.error("Firebase Admin is not configured for replies");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const { parentId, content } = await request.json();
    
    // Validate and sanitize parentId
    const sanitizedParentId = sanitizeDocId(parentId);
    if (!sanitizedParentId) {
      return NextResponse.json({ error: "Invalid parentId format" }, { status: 400 });
    }
    
    // Sanitize content to prevent XSS
    const sanitizedContent = sanitizeText(typeof content === "string" ? content : "");
    if (sanitizedContent.length < 100 || sanitizedContent.length > 500) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const parentRef = db.collection("communityMessages").doc(sanitizedParentId);
    const replyRef = db.collection("communityMessages").doc();

    const authorName =
      user.name || (user.email ? user.email.split("@")[0] : "Anonymous");

    const result = await db.runTransaction(async (tx) => {
      const parentSnap = await tx.get(parentRef);
      if (!parentSnap.exists) {
        return { status: 404 as const, body: { error: "Parent message not found" } };
      }

      const parentData = parentSnap.data() || {};
      const replyCount = Number(parentData.replyCount || 0);

      tx.set(replyRef, {
        content: sanitizedContent,
        authorId: user.uid,
        authorName,
        authorPhoto: user.picture || null,
        createdAt: FieldValue.serverTimestamp(),
        parentId: sanitizedParentId,
        likeCount: 0,
        dislikeCount: 0,
        replyCount: 0,
        repostCount: 0,
      });

      tx.update(parentRef, {
        replyCount: replyCount + 1,
        lastReplyAt: FieldValue.serverTimestamp(),
      });

      return { status: 200 as const, body: { replyId: replyRef.id } };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/community/reply" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
