import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getCurrentVirtualHackathonId, isVirtualHackathonId } from "@/lib/hackathons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function parseRepoUrl(repoUrl: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(repoUrl);
    if (u.hostname !== "github.com" && u.hostname !== "www.github.com") return null;
    const parts = u.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    if (parts.length >= 2) return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
    return null;
  } catch {
    return null;
  }
}

/**
 * GET /api/hackathons/submissions/check-disqualified?hackathonId=virtual-2025-01
 * Intended for cron or manual run after the 1st of the month.
 * Fetches submissions for the hackathon that have been submitted, checks GitHub for commits after cutoff; marks disqualified if any.
 */
export async function GET(request: NextRequest) {
  try {
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const hackathonId =
      request.nextUrl.searchParams.get("hackathonId") || getCurrentVirtualHackathonId();

    if (!isVirtualHackathonId(hackathonId)) {
      return NextResponse.json(
        { error: "check-disqualified is only for virtual hackathons" },
        { status: 400 }
      );
    }

    const submissionsSnap = await db
      .collection("hackathonSubmissions")
      .where("hackathonId", "==", hackathonId)
      .get();

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };
    if (GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    }

    let disqualifiedCount = 0;

    for (const docSnap of submissionsSnap.docs) {
      const data = docSnap.data();
      if (data.disqualified || !data.submittedAt || !data.repoUrl || !data.cutoffAt) continue;

      const cutoffAt = data.cutoffAt?.toDate ? data.cutoffAt.toDate() : new Date(data.cutoffAt);
      const since = cutoffAt.toISOString();

      const parsed = parseRepoUrl(data.repoUrl);
      if (!parsed) continue;

      try {
        const commitsRes = await fetch(
          `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits?since=${encodeURIComponent(since)}`,
          { headers }
        );

        if (!commitsRes.ok) continue;

        const commits = (await commitsRes.json()) as unknown[];
        const hasCommitAfterCutoff = Array.isArray(commits) && commits.length > 0;

        if (hasCommitAfterCutoff) {
          await docSnap.ref.update({
            disqualified: true,
            disqualifiedReason: "Commit after cutoff",
            updatedAt: FieldValue.serverTimestamp(),
          });
          disqualifiedCount++;
        }
      } catch {
        // Skip on error (rate limit, repo gone, etc.)
      }
    }

    return NextResponse.json({
      hackathonId,
      disqualifiedCount,
      message: `Checked submissions for ${hackathonId}; disqualified ${disqualifiedCount}.`,
    });
  } catch (e) {
    console.error("[hackathons/submissions/check-disqualified]", e);
    return NextResponse.json({ error: "Failed to check disqualifications" }, { status: 500 });
  }
}
