/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// @contracts: profileContract.visibilityGet (lib/api-schemas/profile.ts)

import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getClientIdentifier } from "@/lib/rate-limit";
import { checkUpstashRateLimit } from "@/lib/upstash-rate-limit";
import { profileContract } from "@/lib/api-schemas/profile";

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
    const rateResult = await checkUpstashRateLimit(`profile-visibility:${clientId}`, RATE_LIMIT);
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

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }
    const parsed = profileContract.visibilityPatch.body.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }
    const body = parsed.data;

    // Build visibility updates from validated body — only boolean fields
    // declared in the contract make it through.
    const visibilityUpdates: Record<string, boolean> = {};
    for (const [field, value] of Object.entries(body)) {
      if (typeof value === "boolean") {
        visibilityUpdates[`visibility.${field}`] = value;
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
    const rateResult = await checkUpstashRateLimit(`profile-visibility-get:${clientId}`, RATE_LIMIT);
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
