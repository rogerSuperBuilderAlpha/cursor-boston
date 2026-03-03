import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  getPairProfileServer,
  getAllActiveProfilesServer,
} from "@/lib/pair-programming/data-server";
import { getTopMatches } from "@/lib/pair-programming/matching";

/**
 * GET /api/pair/matches
 * Get top matches for the authenticated user
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
