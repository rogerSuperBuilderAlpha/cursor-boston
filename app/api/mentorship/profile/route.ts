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
import type { MentorshipProfile, MentorshipRole } from "@/lib/mentorship/types";

const VALID_ROLES: MentorshipRole[] = ["mentor", "mentee", "both"];
const MAX_ARRAY_LENGTH = 20;
const MAX_STRING_LENGTH = 200;

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
    } = bodyOrError;

    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, error: "role must be 'mentor', 'mentee', or 'both'" },
        { status: 400 }
      );
    }

    if (!timezone || typeof timezone !== "string") {
      return NextResponse.json(
        { success: false, error: "timezone is required" },
        { status: 400 }
      );
    }

    const arraysToCheck = [
      expertise || [],
      learningGoals || [],
      preferredLanguages || [],
    ];
    if (arraysToCheck.some((a) => !Array.isArray(a) || a.length > MAX_ARRAY_LENGTH)) {
      return NextResponse.json(
        { success: false, error: `Arrays cannot exceed ${MAX_ARRAY_LENGTH} items` },
        { status: 400 }
      );
    }

    const allStrings = [...(expertise || []), ...(learningGoals || []), ...(preferredLanguages || [])];
    if (!allStrings.every((s: unknown) => typeof s === "string" && s.length <= MAX_STRING_LENGTH)) {
      return NextResponse.json(
        { success: false, error: "Array items must be strings under 200 characters" },
        { status: 400 }
      );
    }

    if (bio && typeof bio === "string" && bio.length > 1000) {
      return NextResponse.json(
        { success: false, error: "Bio cannot exceed 1000 characters" },
        { status: 400 }
      );
    }

    if (maxMentees !== undefined && (typeof maxMentees !== "number" || maxMentees < 1 || maxMentees > 10)) {
      return NextResponse.json(
        { success: false, error: "maxMentees must be between 1 and 10" },
        { status: 400 }
      );
    }

    const profile: Omit<MentorshipProfile, "userId" | "createdAt" | "updatedAt"> = {
      role,
      expertise: (expertise || []).map((s: string) => s.trim()).filter(Boolean),
      learningGoals: (learningGoals || []).map((s: string) => s.trim()).filter(Boolean),
      preferredLanguages: (preferredLanguages || []).map((s: string) => s.trim()).filter(Boolean),
      timezone: timezone.trim(),
      availability: Array.isArray(availability) ? availability : [],
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
