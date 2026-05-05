/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  getMentorshipProfileServer,
  getAllActiveMentorshipProfilesServer,
} from "@/lib/mentorship/data-server";
import { getTopMentorshipMatches } from "@/lib/mentorship/matching";

/**
 * GET /api/mentorship/matches
 * Get top mentor/mentee matches for the authenticated user
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

    const userProfile = await getMentorshipProfileServer(user.uid);
    if (!userProfile || !userProfile.isActive) {
      return NextResponse.json(
        { success: false, error: "No active profile found. Create a profile first." },
        { status: 404 }
      );
    }

    const allProfiles = await getAllActiveMentorshipProfilesServer();
    const matches = getTopMentorshipMatches(userProfile, allProfiles, 20);

    return NextResponse.json({ success: true, matches });
  } catch (error) {
    console.error("Error fetching mentorship matches:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch matches" },
      { status: 500 }
    );
  }
}
