import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 30 };

/**
 * PATCH /api/profile/visibility
 * Update profile visibility settings.
 * Body: { isPublic?: boolean, showDiscord?: boolean, ... }
 */
export async function PATCH(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`profile-visibility:${clientId}`, RATE_LIMIT);
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
    
    // Allowed visibility fields to update
    const allowedFields = [
      "isPublic",
      "showEmail",
      "showBio",
      "showLocation",
      "showCompany",
      "showJobTitle",
      "showDiscord",
      "showGithubBadge",
      "showEventsAttended",
      "showTalksGiven",
      "showWebsite",
      "showLinkedIn",
      "showTwitter",
      "showGithub",
      "showSubstack",
      "showMemberSince",
    ];

    // Build visibility updates
    const visibilityUpdates: Record<string, boolean> = {};
    for (const field of allowedFields) {
      if (typeof body[field] === "boolean") {
        visibilityUpdates[`visibility.${field}`] = body[field];
      }
    }

    if (Object.keys(visibilityUpdates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update user document
    const userRef = db.collection("users").doc(user.uid);
    await userRef.update({
      ...visibilityUpdates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Get updated profile
    const updatedSnap = await userRef.get();
    const updatedData = updatedSnap.data();

    return NextResponse.json({
      success: true,
      visibility: updatedData?.visibility || {},
    });
  } catch (error) {
    console.error("[profile/visibility]", error);
    return NextResponse.json(
      { error: "Failed to update visibility" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/profile/visibility
 * Get current profile visibility settings and completion status.
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`profile-visibility-get:${clientId}`, RATE_LIMIT);
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

    const userRef = db.collection("users").doc(user.uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({
        success: true,
        profile: {
          hasDisplayName: false,
          hasGithub: false,
          hasDiscord: false,
          visibility: {},
        },
      });
    }

    const data = userSnap.data();
    
    return NextResponse.json({
      success: true,
      profile: {
        displayName: data?.displayName || null,
        hasDisplayName: Boolean(data?.displayName?.trim()),
        hasGithub: Boolean(data?.github),
        githubUsername: data?.github?.login || null,
        hasDiscord: Boolean(data?.discord),
        discordUsername: data?.discord?.username || null,
        visibility: data?.visibility || {},
        photoURL: data?.photoURL || null,
      },
    });
  } catch (error) {
    console.error("[profile/visibility GET]", error);
    return NextResponse.json(
      { error: "Failed to get profile" },
      { status: 500 }
    );
  }
}
