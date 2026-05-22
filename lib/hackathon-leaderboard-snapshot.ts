/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Persisted leaderboard snapshot for hackathon event signup pages.
 *
 * The signup leaderboard used to recompute on every GET (Firestore +
 * GitHub fan-out), wrapped in a 30s in-process `unstable_cache`. That cache is
 * per-instance and doesn't survive cold starts, so a quiet site still pays the
 * full fan-out cost on the first hit in each region.
 *
 * Instead we keep a single Firestore doc per event holding the rendered
 * leaderboard payload. GET reads the doc. Mutations (POST/PATCH/DELETE on the
 * signup route, plus offline scripts like seed-luma-registrants and the
 * ranking-freeze snapshot) call `refreshSnapshot` to recompute and overwrite
 * the doc. New events with no snapshot fall through to a fresh compute that
 * also writes the doc on first read.
 *
 * Why a separate collection (not embedded on `hackathonEvents/{eventId}`):
 *   - Snapshot writes are frequent (every claim). Keeping them off the main
 *     event doc avoids fan-out to anything subscribed to event metadata.
 *   - Easier to wipe + rebuild a single event's snapshot from scripts.
 */
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  getConfirmedCapacityForEvent,
  getDeclinedEmailsForEvent,
  getJudgeEmailsForEvent,
} from "@/lib/hackathon-event-signup";
import { fetchMergedPrCountsForLogins } from "@/lib/github-merged-pr-count";
import { getGithubRepoPair } from "@/lib/github-recent-merged-prs";
import { SUMMER_COHORT_COLLECTION } from "@/lib/summer-cohort";

export const HACKATHON_LEADERBOARD_SNAPSHOTS_COLLECTION =
  "hackathonLeaderboardSnapshots";

export type LeaderboardEntryStatus = "confirmed" | "waitlisted";

export interface LeaderboardEntry {
  rank: number;
  userId: string | null;
  displayName: string | null;
  githubLogin: string | null;
  mergedPrCount: number;
  signedUpAt: string;
  creditEligible: boolean;
  status: LeaderboardEntryStatus;
  checkedIn: boolean;
  willBeLate: boolean;
  queuingForSpot: boolean;
  lumaRegistered: boolean;
  /** True when the email matches a Cohort-1 application (status pending/admitted). */
  isCohort1: boolean;
}

export interface LeaderboardPayload {
  entries: LeaderboardEntry[];
  totalCount: number;
  websiteSignupCount: number;
  creditTopN: number;
}

export interface LeaderboardSnapshot extends LeaderboardPayload {
  /** ISO-8601 timestamp of when the snapshot was generated. */
  generatedAt: string;
}

function signedUpAtToMs(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis: () => number }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  return 0;
}

async function fetchUserDataMap(
  db: Firestore,
  userIds: string[]
): Promise<Map<string, DocumentData>> {
  const map = new Map<string, DocumentData>();
  const unique = [...new Set(userIds)];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 10) {
    chunks.push(unique.slice(i, i + 10));
  }
  const chunkResults = await Promise.all(
    chunks.map((chunk) => {
      const refs = chunk.map((id) => db.collection("users").doc(id));
      return db.getAll(...refs);
    })
  );
  for (const snaps of chunkResults) {
    snaps.forEach((s) => {
      if (s.exists) {
        map.set(s.id, s.data() ?? {});
      }
    });
  }
  return map;
}

/** Firestore `in` queries are limited to 10 values. */
const USER_ID_IN_CHUNK = 10;

/**
 * Merged PR counts from pullRequests (same source as contributor badges), not users.pullRequestsCount.
 */
async function countMergedCommunityPrsByUserIds(
  db: Firestore,
  userIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const unique = [...new Set(userIds.filter(Boolean))];
  for (const id of unique) counts.set(id, 0);
  if (unique.length === 0) return counts;

  const { owner, repo } = getGithubRepoPair();
  const expectedRepo = `${owner}/${repo}`;

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += USER_ID_IN_CHUNK) {
    chunks.push(unique.slice(i, i + USER_ID_IN_CHUNK));
  }
  const chunkSnaps = await Promise.all(
    chunks.map((chunk) =>
      db
        .collection("pullRequests")
        .where("userId", "in", chunk)
        .where("state", "==", "merged")
        .get()
    )
  );
  for (const snap of chunkSnaps) {
    for (const doc of snap.docs) {
      const data = doc.data();
      const uid = data.userId as string | undefined;
      if (!uid) continue;
      const repoField = data.repository;
      if (
        typeof repoField === "string" &&
        repoField.length > 0 &&
        repoField !== expectedRepo
      ) {
        continue;
      }
      counts.set(uid, (counts.get(uid) ?? 0) + 1);
    }
  }

  return counts;
}

export interface BuildLeaderboardPayloadOptions {
  /**
   * Bulk merged-PR counts (lowercased login → count) to pass to
   * {@link fetchMergedPrCountsForLogins}. Node scripts pre-fetch via
   * {@link fetchMergedPrCountByAuthorForRepoUncached} and pass them here to
   * bypass the next/cache wrapper that throws outside the Next runtime.
   */
  preloadedBulkPrCounts?: Map<string, number> | null;
}

/**
 * Live compute of the leaderboard payload. Hits Firestore + GitHub.
 *
 * Avoid calling this on every page GET — use {@link readSnapshot} for that.
 * This is the function the snapshot is built from; it's exported so callers
 * outside the API route (admin pages, scripts) can render the live state
 * without going through the snapshot.
 */
export async function buildLeaderboardPayload(
  eventId: string,
  options: BuildLeaderboardPayloadOptions = {}
): Promise<LeaderboardPayload> {
  const { preloadedBulkPrCounts } = options;
  const db = getAdminDb();
  if (!db) throw new Error("Server not configured");

  const judgeEmails = getJudgeEmailsForEvent(eventId);
  const declinedEmails = getDeclinedEmailsForEvent(eventId);

  // Cohort-1 applicant emails (status pending/admitted only). Used to push
  // cohort-1 attendees to the top of this event's leaderboard, since the
  // May 26 immersion is the in-person event for the summer cohort.
  const cohort1Emails = new Set<string>();
  const cohortAppsSnap = await db.collection(SUMMER_COHORT_COLLECTION).get();
  for (const doc of cohortAppsSnap.docs) {
    const d = doc.data();
    const cohorts = Array.isArray(d.cohorts) ? d.cohorts : [];
    if (!cohorts.includes("cohort-1")) continue;
    const status = typeof d.status === "string" ? d.status : "pending";
    if (status !== "pending" && status !== "admitted") continue;
    const email = typeof d.email === "string" ? d.email.trim().toLowerCase() : "";
    if (email) cohort1Emails.add(email);
  }

  const snap = await db
    .collection("hackathonEventSignups")
    .where("eventId", "==", eventId)
    .get();

  const rows: {
    userId: string;
    signedUpAtMs: number;
    mergedPrCount: number;
    displayName: string | null;
    githubLogin: string | null;
    confirmedAt: number | null;
    frozenRank: number | null;
    frozenPrCount: number | null;
    checkedInAt: number | null;
    willBeLate: boolean;
    queuingForSpot: boolean;
    lumaRegistered: boolean;
  }[] = [];

  const userIds = snap.docs.map((d) => d.data().userId as string).filter(Boolean);
  const userMap = await fetchUserDataMap(db, userIds);

  const githubLogins: string[] = [];
  const userIdsWithoutGithub: string[] = [];
  for (const uid of userIds) {
    const profile = userMap.get(uid);
    const login =
      profile?.github && typeof profile.github === "object"
        ? (profile.github as { login?: string }).login
        : undefined;
    if (typeof login === "string" && login.trim()) {
      githubLogins.push(login.trim());
    } else {
      userIdsWithoutGithub.push(uid);
    }
  }

  const [githubMergedByLogin, firestoreMergedCounts] = await Promise.all([
    fetchMergedPrCountsForLogins(githubLogins, preloadedBulkPrCounts),
    userIdsWithoutGithub.length > 0
      ? countMergedCommunityPrsByUserIds(db, userIdsWithoutGithub)
      : Promise.resolve(new Map<string, number>()),
  ]);

  for (const doc of snap.docs) {
    const data = doc.data();
    const userId = data.userId as string;
    if (!userId) continue;
    const profile = userMap.get(userId);
    if (
      typeof profile?.email === "string" &&
      declinedEmails.has(profile.email.toLowerCase())
    ) {
      continue;
    }
    const gh =
      profile?.github && typeof profile.github === "object"
        ? (profile.github as { login?: string }).login
        : undefined;
    const githubLogin = typeof gh === "string" ? gh : null;
    let pr = firestoreMergedCounts.get(userId) ?? 0;
    if (githubLogin) {
      const fromApi = githubMergedByLogin.get(githubLogin.toLowerCase());
      if (fromApi !== undefined) pr = fromApi;
    }
    rows.push({
      userId,
      signedUpAtMs: signedUpAtToMs(data.signedUpAt),
      mergedPrCount: pr,
      displayName:
        typeof profile?.displayName === "string" ? profile.displayName : null,
      githubLogin,
      confirmedAt: data.confirmedAt ? signedUpAtToMs(data.confirmedAt) : null,
      frozenRank: typeof data.frozenRank === "number" ? data.frozenRank : null,
      frozenPrCount: typeof data.frozenPrCount === "number" ? data.frozenPrCount : null,
      checkedInAt: data.checkedInAt ? signedUpAtToMs(data.checkedInAt) : null,
      willBeLate: data.willBeLate === true,
      queuingForSpot: data.queuingForSpot === true,
      lumaRegistered: false, // flipped true below when the Luma loop finds a match
    });
  }

  // Build a set of emails/logins already on the website list to deduplicate
  const websiteEmails = new Set<string>();
  const websiteGithubLogins = new Set<string>();
  for (const uid of userIds) {
    const profile = userMap.get(uid);
    if (typeof profile?.email === "string") websiteEmails.add(profile.email.toLowerCase());
    const gh =
      profile?.github && typeof profile.github === "object"
        ? (profile.github as { login?: string }).login
        : undefined;
    if (typeof gh === "string" && gh.trim()) websiteGithubLogins.add(gh.trim().toLowerCase());
  }

  // Reverse-lookup maps: email/githubLogin → rows index (for merging Luma fields)
  const emailToRowIdx = new Map<string, number>();
  const ghLoginToRowIdx = new Map<string, number>();
  for (let i = 0; i < rows.length; i++) {
    const profile = userMap.get(rows[i].userId);
    if (typeof profile?.email === "string") {
      emailToRowIdx.set(profile.email.toLowerCase(), i);
    }
    const gh =
      profile?.github && typeof profile.github === "object"
        ? (profile.github as { login?: string }).login
        : undefined;
    if (typeof gh === "string" && gh.trim()) {
      ghLoginToRowIdx.set(gh.trim().toLowerCase(), i);
    }
  }

  // Fetch Luma-only registrants
  const lumaSnap = await db
    .collection("hackathonLumaRegistrants")
    .where("eventId", "==", eventId)
    .get();

  const lumaGithubLogins: string[] = [];
  type LumaRow = {
    name: string;
    email: string | null;
    githubLogin: string | null;
    lumaCreatedAt: string;
    mergedPrCount: number;
    confirmedAt: number | null;
    frozenRank: number | null;
    frozenPrCount: number | null;
  };
  const lumaRows: LumaRow[] = [];

  for (const doc of lumaSnap.docs) {
    const d = doc.data();
    const email = (d.email as string || "").toLowerCase();
    const ghLogin = typeof d.githubLogin === "string" ? d.githubLogin : null;
    if (judgeEmails.has(email) || declinedEmails.has(email)) continue;

    const matchIdx = websiteEmails.has(email)
      ? emailToRowIdx.get(email)
      : (ghLogin && websiteGithubLogins.has(ghLogin.toLowerCase()))
        ? ghLoginToRowIdx.get(ghLogin.toLowerCase())
        : undefined;
    if (matchIdx !== undefined) {
      rows[matchIdx].lumaRegistered = true;
      if (rows[matchIdx].confirmedAt == null && d.confirmedAt) {
        rows[matchIdx].confirmedAt = signedUpAtToMs(d.confirmedAt);
      }
      if (rows[matchIdx].frozenRank == null && typeof d.frozenRank === "number") {
        rows[matchIdx].frozenRank = d.frozenRank;
      }
      if (rows[matchIdx].frozenPrCount == null && typeof d.frozenPrCount === "number") {
        rows[matchIdx].frozenPrCount = d.frozenPrCount;
      }
      const lumaMs = d.lumaCreatedAt ? new Date(d.lumaCreatedAt as string).getTime() : 0;
      if (lumaMs > 0 && lumaMs < rows[matchIdx].signedUpAtMs) {
        rows[matchIdx].signedUpAtMs = lumaMs;
      }
      continue;
    }
    if (ghLogin) lumaGithubLogins.push(ghLogin);
    lumaRows.push({
      name: typeof d.name === "string" ? d.name : "",
      email: email || null,
      githubLogin: ghLogin,
      lumaCreatedAt: typeof d.lumaCreatedAt === "string" ? d.lumaCreatedAt : "",
      mergedPrCount: 0,
      confirmedAt: d.confirmedAt ? signedUpAtToMs(d.confirmedAt) : null,
      frozenRank: typeof d.frozenRank === "number" ? d.frozenRank : null,
      frozenPrCount: typeof d.frozenPrCount === "number" ? d.frozenPrCount : null,
    });
  }

  if (lumaGithubLogins.length > 0) {
    const lumaPrCounts = await fetchMergedPrCountsForLogins(
      lumaGithubLogins,
      preloadedBulkPrCounts
    );
    for (const lr of lumaRows) {
      if (lr.githubLogin) {
        const count = lumaPrCounts.get(lr.githubLogin.toLowerCase());
        if (count !== undefined) lr.mergedPrCount = count;
      }
    }
  }

  type UnifiedRow = {
    userId: string | null;
    displayName: string | null;
    githubLogin: string | null;
    mergedPrCount: number;
    signedUpAtMs: number;
    signedUpAtIso: string;
    confirmedAt: number | null;
    frozenRank: number | null;
    frozenPrCount: number | null;
    checkedInAt: number | null;
    willBeLate: boolean;
    queuingForSpot: boolean;
    lumaRegistered: boolean;
    isCohort1: boolean;
  };
  const unified: UnifiedRow[] = [];

  for (const r of rows) {
    const profile = userMap.get(r.userId);
    const email =
      typeof profile?.email === "string" ? profile.email.trim().toLowerCase() : "";
    unified.push({
      userId: r.userId,
      displayName: r.displayName,
      githubLogin: r.githubLogin,
      mergedPrCount: r.mergedPrCount,
      signedUpAtMs: r.signedUpAtMs,
      signedUpAtIso: new Date(r.signedUpAtMs).toISOString(),
      confirmedAt: r.confirmedAt,
      frozenRank: r.frozenRank,
      frozenPrCount: r.frozenPrCount,
      checkedInAt: r.checkedInAt,
      willBeLate: r.willBeLate,
      queuingForSpot: r.queuingForSpot,
      lumaRegistered: r.lumaRegistered,
      isCohort1: email ? cohort1Emails.has(email) : false,
    });
  }
  for (const lr of lumaRows) {
    const email = lr.email?.trim().toLowerCase() ?? "";
    unified.push({
      userId: null,
      displayName: lr.name || null,
      githubLogin: lr.githubLogin,
      mergedPrCount: lr.mergedPrCount,
      signedUpAtMs: lr.lumaCreatedAt ? new Date(lr.lumaCreatedAt).getTime() : 0,
      signedUpAtIso: lr.lumaCreatedAt,
      confirmedAt: lr.confirmedAt,
      frozenRank: typeof lr.frozenRank === "number" ? lr.frozenRank : null,
      frozenPrCount: typeof lr.frozenPrCount === "number" ? lr.frozenPrCount : null,
      checkedInAt: null,
      willBeLate: false,
      queuingForSpot: false,
      lumaRegistered: true,
      isCohort1: email ? cohort1Emails.has(email) : false,
    });
  }

  const confirmed = unified.filter((u) => u.confirmedAt != null);
  const waitlisted = unified.filter((u) => u.confirmedAt == null);

  confirmed.sort((a, b) => {
    if (a.isCohort1 !== b.isCohort1) return a.isCohort1 ? -1 : 1;
    if (a.frozenRank != null && b.frozenRank != null) return a.frozenRank - b.frozenRank;
    if (a.frozenRank != null) return -1;
    if (b.frozenRank != null) return 1;
    if (b.mergedPrCount !== a.mergedPrCount) return b.mergedPrCount - a.mergedPrCount;
    return a.signedUpAtMs - b.signedUpAtMs;
  });

  waitlisted.sort((a, b) => {
    if (a.isCohort1 !== b.isCohort1) return a.isCohort1 ? -1 : 1;
    if (b.mergedPrCount !== a.mergedPrCount) return b.mergedPrCount - a.mergedPrCount;
    return a.signedUpAtMs - b.signedUpAtMs;
  });

  const sorted = [...confirmed, ...waitlisted];

  const websiteCount = rows.length;
  const entries: LeaderboardEntry[] = sorted.map((u, i) => {
    const rank = i + 1;
    const isConfirmed = u.confirmedAt != null;
    const displayPrs =
      isConfirmed && u.frozenPrCount != null ? u.frozenPrCount : u.mergedPrCount;
    return {
      rank,
      userId: u.userId,
      displayName: u.displayName,
      githubLogin: u.githubLogin,
      mergedPrCount: displayPrs,
      signedUpAt: u.signedUpAtIso,
      creditEligible: isConfirmed,
      status: isConfirmed ? "confirmed" : "waitlisted",
      checkedIn: u.checkedInAt != null,
      willBeLate: u.willBeLate,
      queuingForSpot: u.queuingForSpot,
      lumaRegistered: u.lumaRegistered,
      isCohort1: u.isCohort1,
    };
  });

  return {
    entries,
    totalCount: entries.length,
    websiteSignupCount: websiteCount,
    creditTopN: getConfirmedCapacityForEvent(eventId),
  };
}

/**
 * Read the persisted snapshot for an event. Returns null if no snapshot has
 * been written yet (callers should fall through to {@link refreshSnapshot}).
 */
export async function readSnapshot(
  eventId: string
): Promise<LeaderboardSnapshot | null> {
  const db = getAdminDb();
  if (!db) return null;
  const doc = await db
    .collection(HACKATHON_LEADERBOARD_SNAPSHOTS_COLLECTION)
    .doc(eventId)
    .get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (!data || !Array.isArray(data.entries)) return null;
  const generatedAt =
    typeof data.generatedAt === "string"
      ? data.generatedAt
      : data.generatedAt &&
          typeof (data.generatedAt as { toDate?: () => Date }).toDate === "function"
        ? (data.generatedAt as { toDate: () => Date }).toDate().toISOString()
        : new Date(0).toISOString();
  return {
    entries: data.entries as LeaderboardEntry[],
    totalCount:
      typeof data.totalCount === "number"
        ? data.totalCount
        : (data.entries as unknown[]).length,
    websiteSignupCount:
      typeof data.websiteSignupCount === "number" ? data.websiteSignupCount : 0,
    creditTopN:
      typeof data.creditTopN === "number"
        ? data.creditTopN
        : getConfirmedCapacityForEvent(eventId),
    generatedAt,
  };
}

/**
 * Recompute the leaderboard from Firestore + GitHub and persist as the new
 * snapshot. Called from POST/PATCH/DELETE on the signup route after the
 * underlying mutation lands, and from scripts/snapshot-hackathon-leaderboard.ts
 * for the initial seed (or manual refresh).
 */
export async function refreshSnapshot(
  eventId: string,
  options: BuildLeaderboardPayloadOptions = {}
): Promise<LeaderboardSnapshot> {
  const db = getAdminDb();
  if (!db) throw new Error("Server not configured");
  const payload = await buildLeaderboardPayload(eventId, options);
  const generatedAtIso = new Date().toISOString();
  await db
    .collection(HACKATHON_LEADERBOARD_SNAPSHOTS_COLLECTION)
    .doc(eventId)
    .set({
      ...payload,
      generatedAt: FieldValue.serverTimestamp(),
    });
  return { ...payload, generatedAt: generatedAtIso };
}

/**
 * Return the cached snapshot if present, otherwise compute + persist + return
 * a fresh one. Use this from API GETs so the first hit after a deploy/wipe
 * doesn't 500.
 */
export async function getSnapshotOrRefresh(
  eventId: string
): Promise<LeaderboardSnapshot> {
  const existing = await readSnapshot(eventId);
  if (existing) return existing;
  return refreshSnapshot(eventId);
}
