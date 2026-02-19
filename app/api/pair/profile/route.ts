import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  getPairProfileServer,
  getAllActiveProfilesServer,
  createOrUpdatePairProfileServer,
} from "@/lib/pair-programming/data";
import { getTopMatches } from "@/lib/pair-programming/matching";
import type { PairProfile } from "@/lib/pair-programming/types";

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

    // Validation
    if (!Array.isArray(skillsCanTeach) || !Array.isArray(skillsWantToLearn)) {
      return NextResponse.json(
        { success: false, error: "Skills arrays are required" },
        { status: 400 }
      );
    }

    if (!timezone || !Array.isArray(sessionTypes) || sessionTypes.length === 0) {
      return NextResponse.json(
        { success: false, error: "Timezone and at least one session type required" },
        { status: 400 }
      );
    }

    const profile: Omit<PairProfile, "userId" | "createdAt" | "updatedAt"> = {
      skillsCanTeach: skillsCanTeach || [],
      skillsWantToLearn: skillsWantToLearn || [],
      preferredLanguages: preferredLanguages || [],
      preferredFrameworks: preferredFrameworks || [],
      timezone,
      availability: availability || [],
      sessionTypes,
      bio,
      isActive: isActive !== undefined ? isActive : true,
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

/**
 * GET /api/pair/profile/matches
 * Get top matches for the authenticated user
 */
export async function GET_MATCHES(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const userProfile = await getPairProfileServer(user.uid);
    if (!userProfile || !userProfile.isActive) {
      return NextResponse.json(
        { success: false, error: "No active profile found. Create a profile first." },
        { status: 404 }
      );
    }

    const allProfiles = await getAllActiveProfilesServer();
    const matches = await getTopMatches(userProfile, allProfiles, 20);

    return NextResponse.json({
      success: true,
      matches,
    });
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch matches" },
      { status: 500 }
    );
  }
}
