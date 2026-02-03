import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { sanitizeName, sanitizeUrl, sanitizeDocId } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HACKATHON_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 20 };

/**
 * PATCH /api/hackathons/team/profile
 * Body: { teamId, name?, logoUrl? }
 * Update team profile (name and logo). Only allowed when team has wins >= 1 and caller is a member.
 */
export async function PATCH(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`hackathon-team-profile:${clientId}`, HACKATHON_RATE_LIMIT);
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
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const { teamId, name, logoUrl } = body;
    
    // Validate and sanitize teamId
    const sanitizedTeamId = sanitizeDocId(teamId);
    if (!sanitizedTeamId) {
      return NextResponse.json({ error: "Invalid teamId format" }, { status: 400 });
    }

    const teamRef = db.collection("hackathonTeams").doc(sanitizedTeamId);
    const teamSnap = await teamRef.get();
    if (!teamSnap.exists) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const team = teamSnap.data()!;
    const memberIds: string[] = team.memberIds || [];
    if (!memberIds.includes(user.uid)) {
      return NextResponse.json({ error: "You are not a member of this team" }, { status: 403 });
    }

    const wins = team.wins ?? 0;
    if (wins < 1) {
      return NextResponse.json(
        { error: "Team profile is unlocked after winning a hackathon (wins >= 1)" },
        { status: 403 }
      );
    }

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    
    // Sanitize and validate name
    if (typeof name === "string") {
      const sanitizedName = sanitizeName(name);
      if (sanitizedName.length > 50) {
        return NextResponse.json({ error: "Name must be 50 characters or less" }, { status: 400 });
      }
      updates.name = sanitizedName || null;
    }
    
    // Sanitize and validate logoUrl
    if (typeof logoUrl === "string") {
      if (logoUrl.trim()) {
        const sanitizedUrl = sanitizeUrl(logoUrl);
        if (!sanitizedUrl) {
          return NextResponse.json({ error: "Invalid logoUrl format" }, { status: 400 });
        }
        updates.logoUrl = sanitizedUrl;
      } else {
        updates.logoUrl = null;
      }
    }
    
    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: "Provide name and/or logoUrl" }, { status: 400 });
    }

    await teamRef.update(updates);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[hackathons/team/profile]", e);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
