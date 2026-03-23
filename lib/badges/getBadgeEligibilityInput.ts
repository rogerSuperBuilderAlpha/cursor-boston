import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { getUserStats } from "../registrations";
import type { BadgeEligibilityInput } from "./types";

export async function getBadgeEligibilityInput(user: {
  uid: string;
  displayName?: string | null;
  visibility?: { isPublic?: boolean } | null;
  discord?: unknown;
  github?: unknown;
}): Promise<BadgeEligibilityInput> {
  const base: BadgeEligibilityInput = {
    hasDisplayName: Boolean(user.displayName?.trim()),
    isPublicProfile: Boolean(user.visibility?.isPublic),
    hasDiscordConnected: Boolean(user.discord),
    hasGithubConnected: Boolean(user.github),
    eventsAttendedCount: 0,
    talksGivenCount: 0,
    pullRequestsCount: 0,
    communityPostsCount: 0,
    hackathonParticipationCount: 0,
    showcaseSubmissionsCount: 0,
    mentorMatchesCount: 0,
  };

  if (!user.uid) {
    return base;
  }

  try {
    const stats = await getUserStats(user.uid);
    base.eventsAttendedCount = stats.eventsAttended || 0;
    base.talksGivenCount = stats.talksGiven || 0;
    base.pullRequestsCount = stats.pullRequestsCount || 0;
  } catch {
    // Keep defaults if stats cannot be loaded
  }

  if (!db) {
    return base;
  }

  try {
    const messagesRef = collection(db, "communityMessages");
    const postsQuery = query(messagesRef, where("authorId", "==", user.uid));
    const snapshot = await getDocs(postsQuery);

    base.communityPostsCount = snapshot.docs.filter((doc) => {
      const data = doc.data() as { parentId?: string | null };
      return !data.parentId;
    }).length;
  } catch {
    // Keep defaults if posts cannot be loaded
  }

  return base;
}
