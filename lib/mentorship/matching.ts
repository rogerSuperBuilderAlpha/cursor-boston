/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { MentorshipProfile, MentorshipMatchScore } from "./types";

/**
 * Calculate match score between a seeker and a candidate.
 *
 * When a mentee seeks a mentor: seeker = mentee, candidate = mentor
 *   → candidate.expertise should overlap with seeker.learningGoals
 * When a mentor seeks a mentee: seeker = mentor, candidate = mentee
 *   → candidate.learningGoals should overlap with seeker.expertise
 */
export function calculateMentorshipMatchScore(
  seeker: MentorshipProfile,
  candidate: MentorshipProfile
): MentorshipMatchScore {
  let score = 0;
  const reasons: string[] = [];

  // Goal/expertise alignment (highest weight — 50 pts)
  const seekerIsLookingForMentor =
    seeker.role === "mentee" || seeker.role === "both";

  const goalMatches = seekerIsLookingForMentor
    ? candidate.expertise.filter((exp) =>
        seeker.learningGoals.some((g) => normalizeSkill(g) === normalizeSkill(exp))
      )
    : candidate.learningGoals.filter((goal) =>
        seeker.expertise.some((exp) => normalizeSkill(exp) === normalizeSkill(goal))
      );

  const goalScore = Math.min(50, goalMatches.length * 10);
  score += goalScore;
  if (goalMatches.length > 0) {
    reasons.push(
      seekerIsLookingForMentor
        ? `Can mentor you in: ${goalMatches.join(", ")}`
        : `Wants to learn: ${goalMatches.join(", ")}`
    );
  }

  // Language overlap (20 pts)
  const langOverlap = seeker.preferredLanguages.filter((l) =>
    candidate.preferredLanguages.includes(l)
  );
  const langScore = Math.min(20, langOverlap.length * 5);
  score += langScore;
  if (langOverlap.length > 0) {
    reasons.push(`Shared languages: ${langOverlap.join(", ")}`);
  }

  // Timezone compatibility (10 pts)
  if (seeker.timezone === candidate.timezone) {
    score += 10;
    reasons.push("Same timezone — easier scheduling");
  } else {
    const diff = getTimezoneDifference(seeker.timezone, candidate.timezone);
    if (diff !== null && Math.abs(diff) <= 3) {
      score += 5;
      reasons.push("Similar timezone");
    }
  }

  // Availability overlap (15 pts)
  const availScore = calculateAvailabilityOverlap(
    seeker.availability,
    candidate.availability
  );
  score += availScore;
  if (availScore > 0) {
    reasons.push("Overlapping availability");
  }

  // Profile completeness penalty — sparse profiles get a score reduction
  const candidateDepth =
    candidate.expertise.length +
    candidate.learningGoals.length +
    candidate.preferredLanguages.length;
  if (candidateDepth === 0) {
    score = Math.round(score * 0.3);
    reasons.push("Limited profile");
  } else if (candidateDepth < 2) {
    score = Math.round(score * 0.6);
  }

  return {
    userId: candidate.userId,
    score: Math.min(100, Math.round(score)),
    reasons: reasons.length > 0 ? reasons : ["Potential match based on profiles"],
  };
}

function normalizeSkill(s: string): string {
  return s.toLowerCase().trim();
}

function getTimezoneDifference(tz1: string, tz2: string): number | null {
  try {
    const now = new Date();
    const d1 = new Date(now.toLocaleString("en-US", { timeZone: tz1 }));
    const d2 = new Date(now.toLocaleString("en-US", { timeZone: tz2 }));
    return (d2.getTime() - d1.getTime()) / (1000 * 60 * 60);
  } catch {
    return null;
  }
}

function calculateAvailabilityOverlap(
  avail1: MentorshipProfile["availability"],
  avail2: MentorshipProfile["availability"]
): number {
  if (avail1.length === 0 || avail2.length === 0) return 0;
  let count = 0;
  for (const w1 of avail1) {
    for (const w2 of avail2) {
      if (w1.dayOfWeek === w2.dayOfWeek && timeRangesOverlap(w1.startTime, w1.endTime, w2.startTime, w2.endTime)) {
        count++;
      }
    }
  }
  return Math.min(15, count * 3);
}

function timeRangesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  return toMins(s1) < toMins(e2) && toMins(s2) < toMins(e1);
}

/**
 * Return top matches for a seeker from a pool of candidate profiles.
 * Filters out the seeker and inactive profiles.
 */
export function getTopMentorshipMatches(
  seeker: MentorshipProfile,
  candidates: MentorshipProfile[],
  limit = 10
): MentorshipMatchScore[] {
  return candidates
    .filter((c) => c.userId !== seeker.userId && c.isActive)
    .map((c) => calculateMentorshipMatchScore(seeker, c))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
