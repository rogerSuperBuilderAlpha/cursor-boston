import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { getCurrentVirtualHackathonId, getVirtualMonthStartEndUtc, isVirtualHackathonId } from "@/lib/hackathons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

/**
 * Parse repo URL to owner/repo (e.g. https://github.com/owner/repo -> owner/repo).
 */
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
 * POST /api/hackathons/submissions/register
 * Body: { repoUrl, hackathonId? }
 * Validate repo (public, created during hackathon month) and create/update hackathonSubmissions.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const repoUrl = (body.repoUrl as string)?.trim();
    const hackathonId = (body.hackathonId as string) || getCurrentVirtualHackathonId();

    if (!repoUrl) {
      return NextResponse.json({ error: "repoUrl required" }, { status: 400 });
    }

    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid GitHub repo URL. Use https://github.com/owner/repo" },
        { status: 400 }
      );
    }

    if (!isVirtualHackathonId(hackathonId)) {
      return NextResponse.json(
        { error: "Repo registration is only for virtual (monthly) hackathons" },
        { status: 400 }
      );
    }

    const teamSnap = await db
      .collection("hackathonTeams")
      .where("hackathonId", "==", hackathonId)
      .where("memberIds", "array-contains", user.uid)
      .limit(1)
      .get();

    if (teamSnap.empty) {
      return NextResponse.json({ error: "You are not on a team for this hackathon" }, { status: 403 });
    }

    const teamDoc = teamSnap.docs[0];
    const teamId = teamDoc.id;

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };
    if (GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    }

    const ghRes = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
      { headers }
    );

    if (ghRes.status === 404) {
      return NextResponse.json(
        { error: "Repo not found or it is private. Repo must be public." },
        { status: 400 }
      );
    }
    if (!ghRes.ok) {
      return NextResponse.json(
        { error: "Could not verify repo with GitHub" },
        { status: 502 }
      );
    }

    const repo = (await ghRes.json()) as { private: boolean; created_at: string };
    if (repo.private) {
      return NextResponse.json(
        { error: "Repo must be public" },
        { status: 400 }
      );
    }

    const range = getVirtualMonthStartEndUtc(hackathonId);
    if (!range) {
      return NextResponse.json({ error: "Invalid hackathon period" }, { status: 400 });
    }

    const createdAt = new Date(repo.created_at);
    if (createdAt < range.start || createdAt > range.end) {
      return NextResponse.json(
        {
          error:
            "Repo must have been created during the hackathon month (" +
            range.start.toISOString().slice(0, 7) +
            ").",
        },
        { status: 400 }
      );
    }

    const submissionId = `${hackathonId}_${teamId}`;
    const submissionRef = db.collection("hackathonSubmissions").doc(submissionId);
    const existing = await submissionRef.get();

    const data: Record<string, unknown> = {
      hackathonId,
      teamId,
      repoUrl,
      registeredBy: user.uid,
      repoCreatedAt: repo.created_at,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (existing.exists) {
      await submissionRef.update(data);
    } else {
      await submissionRef.set({
        ...data,
        registeredAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ registered: true, submissionId, repoUrl });
  } catch (e) {
    console.error("[hackathons/submissions/register]", e);
    return NextResponse.json({ error: "Failed to register repo" }, { status: 500 });
  }
}
