import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReactionType = "like" | "dislike";

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    if (!db) {
      logger.error("Firebase Admin is not configured for reactions");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const { messageId, type } = await request.json();
    if (!messageId || (type !== "like" && type !== "dislike")) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const reactionType = type as ReactionType;
    const messageRef = db.collection("communityMessages").doc(messageId);
    const reactionRef = db.collection("messageReactions").doc(`${messageId}_${user.uid}`);

    const result = await db.runTransaction(async (tx) => {
      const [messageSnap, reactionSnap] = await Promise.all([
        tx.get(messageRef),
        tx.get(reactionRef),
      ]);

      if (!messageSnap.exists) {
        return { status: 404 as const, body: { error: "Message not found" } };
      }

      const messageData = messageSnap.data() || {};
      const likeCount = Number(messageData.likeCount || 0);
      const dislikeCount = Number(messageData.dislikeCount || 0);

      if (reactionSnap.exists) {
        const existingType = reactionSnap.data()?.type as ReactionType | undefined;
        if (existingType === reactionType) {
          // Remove reaction
          tx.delete(reactionRef);
          tx.update(messageRef, {
            likeCount:
              reactionType === "like" ? Math.max(0, likeCount - 1) : likeCount,
            dislikeCount:
              reactionType === "dislike" ? Math.max(0, dislikeCount - 1) : dislikeCount,
            lastReactionAt: FieldValue.serverTimestamp(),
          });
          return { status: 200 as const, body: { action: "removed", type: reactionType } };
        }

        // Switch reaction
        tx.update(reactionRef, {
          type: reactionType,
          updatedAt: FieldValue.serverTimestamp(),
        });
        const nextLikeCount =
          (existingType === "like" ? Math.max(0, likeCount - 1) : likeCount) +
          (reactionType === "like" ? 1 : 0);
        const nextDislikeCount =
          (existingType === "dislike" ? Math.max(0, dislikeCount - 1) : dislikeCount) +
          (reactionType === "dislike" ? 1 : 0);
        tx.update(messageRef, {
          likeCount: nextLikeCount,
          dislikeCount: nextDislikeCount,
          lastReactionAt: FieldValue.serverTimestamp(),
        });
        return {
          status: 200 as const,
          body: { action: "switched", type: reactionType, previousType: existingType },
        };
      }

      // Add reaction
      tx.set(reactionRef, {
        messageId,
        userId: user.uid,
        type: reactionType,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(messageRef, {
        likeCount: reactionType === "like" ? likeCount + 1 : likeCount,
        dislikeCount: reactionType === "dislike" ? dislikeCount + 1 : dislikeCount,
        lastReactionAt: FieldValue.serverTimestamp(),
      });
      return { status: 200 as const, body: { action: "added", type: reactionType } };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/community/reaction" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
