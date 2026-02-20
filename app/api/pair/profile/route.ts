import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  getPairProfileServer,
  createOrUpdatePairProfileServer,
} from "@/lib/pair-programming/data-server";
import type { PairProfile, SessionType } from "@/lib/pair-programming/types";

const VALID_SESSION_TYPES: SessionType[] = [
  "teach-me",
  "build-together",
  "code-review",
  "explore-topic",
];

const MAX_ARRAY_LENGTH = 20;
const MAX_STRING_LENGTH = 500;

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

    const body = await request.json();
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
    } = body;

    // Validate arrays
    if (!Array.isArray(skillsCanTeach) || !Array.isArray(skillsWantToLearn)) {
      return NextResponse.json(
        { success: false, error: "Skills arrays are required" },
        { status: 400 }
      );
    }

    if (!timezone || typeof timezone !== "string") {
      return NextResponse.json(
        { success: false, error: "Timezone is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(sessionTypes) || sessionTypes.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one session type required" },
        { status: 400 }
      );
    }

    // Validate session types
    if (!sessionTypes.every((t: string) => VALID_SESSION_TYPES.includes(t as SessionType))) {
      return NextResponse.json(
        { success: false, error: "Invalid session type" },
        { status: 400 }
      );
    }

    // Validate array lengths
    const arrays = [skillsCanTeach, skillsWantToLearn, preferredLanguages || [], preferredFrameworks || []];
    if (arrays.some((arr) => arr.length > MAX_ARRAY_LENGTH)) {
      return NextResponse.json(
        { success: false, error: `Arrays cannot exceed ${MAX_ARRAY_LENGTH} items` },
        { status: 400 }
      );
    }

    // Validate string items in arrays
    const allStrings = [...skillsCanTeach, ...skillsWantToLearn, ...(preferredLanguages || []), ...(preferredFrameworks || [])];
    if (!allStrings.every((s: unknown) => typeof s === "string" && s.length <= MAX_STRING_LENGTH)) {
      return NextResponse.json(
        { success: false, error: "Invalid array items" },
        { status: 400 }
      );
    }

    // Validate bio length
    if (bio && typeof bio === "string" && bio.length > 1000) {
      return NextResponse.json(
        { success: false, error: "Bio cannot exceed 1000 characters" },
        { status: 400 }
      );
    }

    const profile: Omit<PairProfile, "userId" | "createdAt" | "updatedAt"> = {
      skillsCanTeach: skillsCanTeach.map((s: string) => s.trim()).filter(Boolean),
      skillsWantToLearn: skillsWantToLearn.map((s: string) => s.trim()).filter(Boolean),
      preferredLanguages: (preferredLanguages || []).map((s: string) => s.trim()).filter(Boolean),
      preferredFrameworks: (preferredFrameworks || []).map((s: string) => s.trim()).filter(Boolean),
      timezone: timezone.trim(),
      availability: Array.isArray(availability) ? availability : [],
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
