import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { sanitizeName, sanitizeText, sanitizeUrl } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 20 };

/**
 * PATCH /api/profile/update
 * Update profile fields like displayName, bio, location, etc.
 */
export async function PATCH(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request as unknown as Request);
    const rateResult = checkRateLimit(`profile-update:${clientId}`, RATE_LIMIT);
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
    const updates: Record<string, unknown> = {};

    // Display name
    if (typeof body.displayName === "string") {
      const sanitized = sanitizeName(body.displayName);
      if (sanitized.length < 2) {
        return NextResponse.json(
          { error: "Display name must be at least 2 characters" },
          { status: 400 }
        );
      }
      if (sanitized.length > 50) {
        return NextResponse.json(
          { error: "Display name must be 50 characters or less" },
          { status: 400 }
        );
      }
      updates.displayName = sanitized;
    }

    // Bio
    if (typeof body.bio === "string") {
      const sanitized = sanitizeText(body.bio);
      if (sanitized.length > 500) {
        return NextResponse.json(
          { error: "Bio must be 500 characters or less" },
          { status: 400 }
        );
      }
      updates.bio = sanitized || null;
    }

    // Location
    if (typeof body.location === "string") {
      const sanitized = sanitizeText(body.location);
      if (sanitized.length > 100) {
        return NextResponse.json(
          { error: "Location must be 100 characters or less" },
          { status: 400 }
        );
      }
      updates.location = sanitized || null;
    }

    // Company
    if (typeof body.company === "string") {
      const sanitized = sanitizeText(body.company);
      if (sanitized.length > 100) {
        return NextResponse.json(
          { error: "Company must be 100 characters or less" },
          { status: 400 }
        );
      }
      updates.company = sanitized || null;
    }

    // Job title
    if (typeof body.jobTitle === "string") {
      const sanitized = sanitizeText(body.jobTitle);
      if (sanitized.length > 100) {
        return NextResponse.json(
          { error: "Job title must be 100 characters or less" },
          { status: 400 }
        );
      }
      updates.jobTitle = sanitized || null;
    }

    // Social links
    if (body.socialLinks && typeof body.socialLinks === "object") {
      const socialUpdates: Record<string, string | null> = {};
      
      for (const [key, value] of Object.entries(body.socialLinks)) {
        if (typeof value === "string" && value.trim()) {
          const sanitized = sanitizeUrl(value);
          if (sanitized) {
            socialUpdates[key] = sanitized;
          }
        } else {
          socialUpdates[key] = null;
        }
      }
      
      if (Object.keys(socialUpdates).length > 0) {
        // Merge with existing social links
        const userRef = db.collection("users").doc(user.uid);
        const userSnap = await userRef.get();
        const existingSocial = userSnap.data()?.socialLinks || {};
        updates.socialLinks = { ...existingSocial, ...socialUpdates };
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update user document
    const userRef = db.collection("users").doc(user.uid);
    await userRef.update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Get updated profile
    const updatedSnap = await userRef.get();
    const updatedData = updatedSnap.data();

    return NextResponse.json({
      success: true,
      profile: {
        displayName: updatedData?.displayName,
        bio: updatedData?.bio,
        location: updatedData?.location,
        company: updatedData?.company,
        jobTitle: updatedData?.jobTitle,
        socialLinks: updatedData?.socialLinks,
      },
    });
  } catch (error) {
    console.error("[profile/update]", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
