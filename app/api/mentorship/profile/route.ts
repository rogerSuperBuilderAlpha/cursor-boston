/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  getMentorshipProfileServer,
  createOrUpdateMentorshipProfileServer,
} from "@/lib/mentorship/data-server";
import { parseRequestBody } from "@/lib/api-response";
import type {
  MentorshipAvailability,
  MentorshipProfile,
} from "@/lib/mentorship/types";
import { mentorshipContract } from "@/lib/api-schemas/mentorship";

/**
 * GET /api/mentorship/profile
 * Get the authenticated user's mentorship profile
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

    const profile = await getMentorshipProfileServer(user.uid);
    return NextResponse.json({ success: true, profile: profile || null });
  } catch (error) {
    console.error("Error fetching mentorship profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mentorship/profile
 * Create or update the authenticated user's mentorship profile
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
    const parsed = mentorshipContract.profilePost.body.safeParse(bodyOrError);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }
    const {
      role,
      expertise,
      learningGoals,
      preferredLanguages,
      timezone,
      availability,
      bio,
      maxMentees,
      isActive,
    } = parsed.data;

    const profile: Omit<MentorshipProfile, "userId" | "createdAt" | "updatedAt"> = {
      role,
      expertise: (expertise || []).map((s: string) => s.trim()).filter(Boolean),
      learningGoals: (learningGoals || []).map((s: string) => s.trim()).filter(Boolean),
      preferredLanguages: (preferredLanguages || []).map((s: string) => s.trim()).filter(Boolean),
      timezone: timezone.trim(),
      availability: Array.isArray(availability)
        ? (availability as MentorshipAvailability[])
        : [],
      bio: bio ? String(bio).trim().slice(0, 1000) : undefined,
      maxMentees: maxMentees ?? undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    };

    await createOrUpdateMentorshipProfileServer(user.uid, profile);

    return NextResponse.json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating mentorship profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
