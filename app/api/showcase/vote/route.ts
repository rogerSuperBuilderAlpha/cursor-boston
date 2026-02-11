import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { sanitizeDocId } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VoteType = "up" | "down";

const SHOWCASE_VOTE_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 60 };

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`showcase-vote:${clientId}`, SHOWCASE_VOTE_RATE_LIMIT);
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
      logger.error("Firebase Admin is not configured for showcase votes");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const { projectId, type } = await request.json();

    const sanitizedProjectId = sanitizeDocId(projectId);
    if (!sanitizedProjectId || (type !== "up" && type !== "down")) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const voteType = type as VoteType;
    const projectRef = db.collection("showcaseProjects").doc(sanitizedProjectId);
    const voteRef = db.collection("showcaseVotes").doc(`${sanitizedProjectId}_${user.uid}`);

    const result = await db.runTransaction(async (tx) => {
      const [projectSnap, voteSnap] = await Promise.all([
        tx.get(projectRef),
        tx.get(voteRef),
      ]);

      // Auto-create the project vote doc if it doesn't exist yet
      const projectData = projectSnap.exists ? projectSnap.data() || {} : {};
      const upCount = Number(projectData.upCount || 0);
      const downCount = Number(projectData.downCount || 0);

      if (voteSnap.exists) {
        const existingType = voteSnap.data()?.type as VoteType | undefined;
        if (existingType === voteType) {
          // Remove vote (toggle off)
          tx.delete(voteRef);
          const updates = {
            upCount: voteType === "up" ? Math.max(0, upCount - 1) : upCount,
            downCount: voteType === "down" ? Math.max(0, downCount - 1) : downCount,
            lastVoteAt: FieldValue.serverTimestamp(),
          };
          if (projectSnap.exists) {
            tx.update(projectRef, updates);
          } else {
            tx.set(projectRef, updates);
          }
          return {
            status: 200 as const,
            body: {
              action: "removed",
              type: voteType,
              upCount: updates.upCount,
              downCount: updates.downCount,
            },
          };
        }

        // Switch vote
        tx.update(voteRef, {
          type: voteType,
          updatedAt: FieldValue.serverTimestamp(),
        });
        const nextUpCount =
          (existingType === "up" ? Math.max(0, upCount - 1) : upCount) +
          (voteType === "up" ? 1 : 0);
        const nextDownCount =
          (existingType === "down" ? Math.max(0, downCount - 1) : downCount) +
          (voteType === "down" ? 1 : 0);
        const updates = {
          upCount: nextUpCount,
          downCount: nextDownCount,
          lastVoteAt: FieldValue.serverTimestamp(),
        };
        if (projectSnap.exists) {
          tx.update(projectRef, updates);
        } else {
          tx.set(projectRef, updates);
        }
        return {
          status: 200 as const,
          body: {
            action: "switched",
            type: voteType,
            previousType: existingType,
            upCount: nextUpCount,
            downCount: nextDownCount,
          },
        };
      }

      // Add new vote
      tx.set(voteRef, {
        projectId: sanitizedProjectId,
        userId: user.uid,
        type: voteType,
        createdAt: FieldValue.serverTimestamp(),
      });
      const newUpCount = voteType === "up" ? upCount + 1 : upCount;
      const newDownCount = voteType === "down" ? downCount + 1 : downCount;
      const updates = {
        upCount: newUpCount,
        downCount: newDownCount,
        lastVoteAt: FieldValue.serverTimestamp(),
      };
      if (projectSnap.exists) {
        tx.update(projectRef, updates);
      } else {
        tx.set(projectRef, updates);
      }
      return {
        status: 200 as const,
        body: {
          action: "added",
          type: voteType,
          upCount: newUpCount,
          downCount: newDownCount,
        },
      };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/showcase/vote" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ votes: {}, userVotes: {} });
    }

    // Get all project vote counts
    const projectsSnap = await db.collection("showcaseProjects").get();
    const votes: Record<string, { upCount: number; downCount: number }> = {};
    projectsSnap.forEach((doc) => {
      const data = doc.data();
      votes[doc.id] = {
        upCount: Number(data.upCount || 0),
        downCount: Number(data.downCount || 0),
      };
    });

    // If user is authenticated, get their votes too
    let userVotes: Record<string, string> = {};
    try {
      const user = await getVerifiedUser(request);
      if (user) {
        const userVotesSnap = await db
          .collection("showcaseVotes")
          .where("userId", "==", user.uid)
          .get();
        userVotesSnap.forEach((doc) => {
          const data = doc.data();
          if (data.projectId && data.type) {
            userVotes[data.projectId] = data.type;
          }
        });
      }
    } catch {
      // Not authenticated, that's fine
    }

    return NextResponse.json({ votes, userVotes });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/showcase/vote GET" });
    return NextResponse.json({ votes: {}, userVotes: {} });
  }
}
