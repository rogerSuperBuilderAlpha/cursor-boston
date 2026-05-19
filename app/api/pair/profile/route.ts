/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  getPairProfileServer,
  createOrUpdatePairProfileServer,
} from "@/lib/pair-programming/data-server";
import type { AvailabilityWindow, PairProfile } from "@/lib/pair-programming/types";

import { parseRequestBody } from "@/lib/api-response";
import { pairContract } from "@/lib/api-schemas/pair";

/**
 * GET /api/pair/profile
 * Get the authenticated user's pair programming profile
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const profile = await getPairProfileServer(user.uid);
    return NextResponse.json({
      success: true,
      profile: profile || null,
    });
  } catch (error) {
    console.error("Error fetching pair profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pair/profile
 * Create or update the authenticated user's pair programming profile
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;
    const parsed = pairContract.profilePost.body.safeParse(bodyOrError);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }
    const {
      skillsCanTeach,
      skillsWantToLearn,
      preferredLanguages,
      preferredFrameworks,
      timezone,
      availability,
      sessionTypes,
      bio,
      isActive,
    } = parsed.data;

    const profile: Omit<PairProfile, "userId" | "createdAt" | "updatedAt"> = {
      skillsCanTeach: skillsCanTeach.map((s: string) => s.trim()).filter(Boolean),
      skillsWantToLearn: skillsWantToLearn.map((s: string) => s.trim()).filter(Boolean),
      preferredLanguages: (preferredLanguages || []).map((s: string) => s.trim()).filter(Boolean),
      preferredFrameworks: (preferredFrameworks || []).map((s: string) => s.trim()).filter(Boolean),
      timezone: timezone.trim(),
      availability: Array.isArray(availability)
        ? (availability as AvailabilityWindow[])
        : [],
      sessionTypes,
      bio: bio ? String(bio).trim().slice(0, 1000) : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    };

    await createOrUpdatePairProfileServer(user.uid, profile);

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Error updating pair profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
