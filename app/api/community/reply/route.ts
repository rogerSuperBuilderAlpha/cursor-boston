import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
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
    const trimmed = typeof content === "string" ? content.trim() : "";
    if (!parentId || trimmed.length < 100 || trimmed.length > 500) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const parentRef = db.collection("communityMessages").doc(parentId);
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
        content: trimmed,
        authorId: user.uid,
        authorName,
        authorPhoto: user.picture || null,
        createdAt: FieldValue.serverTimestamp(),
        parentId,
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
