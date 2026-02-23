import type { PairProfile, MatchScore } from "./types";

/**
 * Calculate match score between two profiles based on complementary skills
 * Returns a score from 0-100 and reasons for the match
 */
export function calculateMatchScore(
  profile1: PairProfile,
  profile2: PairProfile
): MatchScore {
  let score = 0;
  const reasons: string[] = [];

  // Skill complementarity (highest weight)
  // Check if profile1 can teach what profile2 wants to learn
  const teachMatches = profile1.skillsCanTeach.filter((skill) =>
    profile2.skillsWantToLearn.some((wanted) =>
      normalizeSkill(skill) === normalizeSkill(wanted)
    )
  );
  // Check if profile2 can teach what profile1 wants to learn
  const learnMatches = profile2.skillsCanTeach.filter((skill) =>
    profile1.skillsWantToLearn.some((wanted) =>
      normalizeSkill(skill) === normalizeSkill(wanted)
    )
  );

  const totalMatches = teachMatches.length + learnMatches.length;
  const skillScore = Math.min(50, totalMatches * 10); // Max 50 points
  score += skillScore;

  if (teachMatches.length > 0) {
    reasons.push(
      `You can teach ${teachMatches.join(", ")} - they want to learn it`
    );
  }
  if (learnMatches.length > 0) {
    reasons.push(
      `They can teach ${learnMatches.join(", ")} - you want to learn it`
    );
  }

  // Language/framework overlap (medium weight)
  const languageOverlap = profile1.preferredLanguages.filter((lang) =>
    profile2.preferredLanguages.includes(lang)
  ).length;
  const frameworkOverlap = profile1.preferredFrameworks.filter((fw) =>
    profile2.preferredFrameworks.includes(fw)
  ).length;
  const overlapScore = Math.min(20, (languageOverlap + frameworkOverlap) * 5);
  score += overlapScore;

  if (languageOverlap > 0 || frameworkOverlap > 0) {
    const common = [
      ...profile1.preferredLanguages.filter((l) =>
        profile2.preferredLanguages.includes(l)
      ),
      ...profile1.preferredFrameworks.filter((f) =>
        profile2.preferredFrameworks.includes(f)
      ),
    ];
    if (common.length > 0) {
      reasons.push(`Shared interests: ${common.join(", ")}`);
    }
  }

  // Session type overlap (low weight)
  const sessionTypeOverlap = profile1.sessionTypes.filter((type) =>
    profile2.sessionTypes.includes(type)
  ).length;
  const sessionScore = Math.min(15, sessionTypeOverlap * 5);
  score += sessionScore;

  if (sessionTypeOverlap > 0) {
    const commonTypes = profile1.sessionTypes.filter((type) =>
      profile2.sessionTypes.includes(type)
    );
    reasons.push(`Both interested in: ${commonTypes.join(", ")}`);
  }

  // Timezone compatibility (low weight)
  // Simple check: same timezone = bonus, different = small penalty
  if (profile1.timezone === profile2.timezone) {
    score += 10;
    reasons.push("Same timezone - easier scheduling");
  } else {
    // Check if timezones are close (within 3 hours)
    const tzDiff = getTimezoneDifference(profile1.timezone, profile2.timezone);
    if (tzDiff !== null && Math.abs(tzDiff) <= 3) {
      score += 5;
      reasons.push("Similar timezone - scheduling should work");
    }
  }

  // Availability overlap (medium weight)
  const availabilityScore = calculateAvailabilityOverlap(
    profile1.availability,
    profile2.availability
  );
  score += availabilityScore;

  if (availabilityScore > 0) {
    reasons.push("Overlapping availability windows");
  }

  // Penalize empty profiles — profiles with no skills listed get reduced scores
  const profile2SkillCount = profile2.skillsCanTeach.length + profile2.skillsWantToLearn.length;
  if (profile2SkillCount === 0) {
    score = Math.round(score * 0.3); // 70% penalty for completely empty skill profiles
    reasons.push("Limited profile — fewer skills listed");
  } else if (profile2SkillCount < 2) {
    score = Math.round(score * 0.6); // 40% penalty for very sparse profiles
  }

  // Cap at 100
  score = Math.min(100, Math.round(score));

  return {
    userId: profile2.userId,
    score,
    reasons: reasons.length > 0 ? reasons : ["Potential match based on profiles"],
  };
}

/**
 * Normalize skill names for comparison (case-insensitive, trim whitespace)
 */
function normalizeSkill(skill: string): string {
  return skill.toLowerCase().trim();
}

/**
 * Get timezone difference in hours (simplified - doesn't handle DST)
 * Returns null if timezones can't be parsed
 */
function getTimezoneDifference(tz1: string, tz2: string): number | null {
  try {
    // Simple approach: extract UTC offset if present
    // This is a simplified version - in production you'd use a proper timezone library
    const now = new Date();
    const date1 = new Date(
      now.toLocaleString("en-US", { timeZone: tz1 })
    );
    const date2 = new Date(
      now.toLocaleString("en-US", { timeZone: tz2 })
    );
    return (date2.getTime() - date1.getTime()) / (1000 * 60 * 60);
  } catch {
    return null;
  }
}

/**
 * Calculate availability overlap score (0-15 points)
 */
function calculateAvailabilityOverlap(
  avail1: PairProfile["availability"],
  avail2: PairProfile["availability"]
): number {
  if (avail1.length === 0 || avail2.length === 0) return 0;

  let overlapCount = 0;
  for (const window1 of avail1) {
    for (const window2 of avail2) {
      if (window1.dayOfWeek === window2.dayOfWeek) {
        // Check if time ranges overlap
        if (timeRangesOverlap(window1.startTime, window1.endTime, window2.startTime, window2.endTime)) {
          overlapCount++;
        }
      }
    }
  }

  // Score based on number of overlapping windows
  return Math.min(15, overlapCount * 3);
}

/**
 * Check if two time ranges overlap
 */
function timeRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const [h1, m1] = start1.split(":").map(Number);
  const [h2, m2] = end1.split(":").map(Number);
  const [h3, m3] = start2.split(":").map(Number);
  const [h4, m4] = end2.split(":").map(Number);

  const time1Start = h1 * 60 + m1;
  const time1End = h2 * 60 + m2;
  const time2Start = h3 * 60 + m3;
  const time2End = h4 * 60 + m4;

  return time1Start < time2End && time2Start < time1End;
}

/**
 * Get top matches for a user profile
 */
export async function getTopMatches(
  userProfile: PairProfile,
  allProfiles: PairProfile[],
  limit: number = 10
): Promise<MatchScore[]> {
  const matches = allProfiles
    .filter((p) => p.userId !== userProfile.userId && p.isActive)
    .map((profile) => calculateMatchScore(userProfile, profile))
    .filter((match) => match.score > 0) // Only include matches with score > 0
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return matches;
}
