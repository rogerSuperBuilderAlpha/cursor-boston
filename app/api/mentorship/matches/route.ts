/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  getMentorshipProfileServer,
  getMentorshipMatchCandidatesServer,
} from "@/lib/mentorship/data-server";
import { getTopMentorshipMatches } from "@/lib/mentorship/matching";

/**
 * GET /api/mentorship/matches
 * Get top mentor/mentee matches for the authenticated user.
 *
 * Read cost is bounded: rather than scanning every active profile,
 * `getMentorshipMatchCandidatesServer` issues 1-2 narrow Firestore
 * queries (`array-contains-any` against denormalized lowercase skill
 * arrays) capped at 100 candidates per direction.
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

    const candidates = await getMentorshipMatchCandidatesServer(userProfile);
    const matches = getTopMentorshipMatches(userProfile, candidates, 20);

    return NextResponse.json({ success: true, matches });
  } catch (error) {
    console.error("Error fetching mentorship matches:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch matches" },
      { status: 500 }
    );
  }
}
