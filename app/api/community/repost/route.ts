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
    const rateResult = checkRateLimit(`community-repost:${clientId}`, COMMUNITY_RATE_LIMIT);
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
      logger.error("Firebase Admin is not configured for reposts");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const { originalId, content } = await request.json();
    
    // Validate and sanitize originalId
    const sanitizedOriginalId = sanitizeDocId(originalId);
    if (!sanitizedOriginalId) {
      return NextResponse.json({ error: "Invalid originalId format" }, { status: 400 });
    }
    
    // Sanitize content to prevent XSS
    const sanitizedContent = sanitizeText(typeof content === "string" ? content : "");
    if (sanitizedContent.length < 100 || sanitizedContent.length > 500) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const originalRef = db.collection("communityMessages").doc(sanitizedOriginalId);
    const repostRef = db.collection("communityMessages").doc();

    const authorName =
      user.name || (user.email ? user.email.split("@")[0] : "Anonymous");

    const result = await db.runTransaction(async (tx) => {
      const originalSnap = await tx.get(originalRef);
      if (!originalSnap.exists) {
        return { status: 404 as const, body: { error: "Original message not found" } };
      }

      const original = originalSnap.data() || {};
      const repostCount = Number(original.repostCount || 0);

      tx.set(repostRef, {
        content: sanitizedContent,
        authorId: user.uid,
        authorName,
        authorPhoto: user.picture || null,
        createdAt: FieldValue.serverTimestamp(),
        repostOf: {
          originalId: sanitizedOriginalId,
          originalAuthorId: original.authorId || null,
          originalAuthorName: sanitizeText(original.authorName || "Unknown"),
          originalContent: sanitizeText(original.content || ""),
        },
        likeCount: 0,
        dislikeCount: 0,
        replyCount: 0,
        repostCount: 0,
      });

      tx.update(originalRef, {
        repostCount: repostCount + 1,
        lastRepostAt: FieldValue.serverTimestamp(),
      });

      return { status: 200 as const, body: { repostId: repostRef.id } };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/community/repost" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
