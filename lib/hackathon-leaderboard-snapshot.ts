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
  getAttendanceLimitForEvent,
  getConfirmedCapacityForEvent,
  getDeclinedEmailsForEvent,
  getJudgeEmailsForEvent,
  getRankingModelForEvent,
} from "@/lib/hackathon-event-signup";
import { fetchMergedPrCountsForLogins } from "@/lib/github-merged-pr-count";
import { getGithubRepoPair } from "@/lib/github-recent-merged-prs";
import { fetchSportsHack2026SubmissionAuthors } from "@/lib/sports-hack-2026-submission-prs";
import { SUMMER_COHORT_COLLECTION } from "@/lib/summer-cohort";

/** @internal */
export const HACKATHON_LEADERBOARD_SNAPSHOTS_COLLECTION =
  "hackathonLeaderboardSnapshots";

/** @internal */
export type LeaderboardEntryStatus = "confirmed" | "waitlisted";

/**
 * Engagement tier for the three-tier ranking model (sports-hack-2026).
 *
 * - `"A"` — claimed AND user-confirmed (`attendingConfirmedBy === "user"`)
 * - `"B"` — claimed only (signup exists, no user-initiated confirmation)
 * - `"C"` — external RSVP only (Luma "approved" or Partiful "Going" row in
 *   `hackathonLumaRegistrants`, no matching website signup)
 * - `null` — event uses the freeze model (hack-a-sprint-2026); tier is inert
 */
/** @internal */
export type LeaderboardEntryTier = "A" | "B" | "C" | null;

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
  /**
   * External-RSVP indicators. Sourced from each `hackathonLumaRegistrants`
   * doc's `rsvpSource` field (written by `sync-may26-partiful-and-luma.ts`
   * as `"partiful" | "luma" | "partiful+luma"`). Both flags can be true at
   * the same time when an attendee RSVP'd on both external lists. Per the
   * 2026-05-24 product call, the public page treats these as interest
   * signals only — the website signup is the source of truth.
   */
  lumaRegistered: boolean;
  partifulRegistered: boolean;
  /** True when the email matches a Cohort-1 application (status pending/admitted). */
  isCohort1: boolean;
  /**
   * True when the user has clicked "Confirm attending" (or has been checked
   * in at the door). Distinct from `creditEligible` / `status` which reflect
   * the offline rank-freeze. Only meaningful when payload.attendanceLimit > 0.
   */
  attendingConfirmed: boolean;
  /** ISO timestamp when the user confirmed attendance, or null. */
  attendingConfirmedAt: string | null;
  /**
   * Rank within the confirmed-attending subset (1-based), preserving the
   * entry's existing `rank` order — NOT re-sorted by confirm time. Null
   * when this entry has not confirmed or the event doesn't use this flow.
   */
  attendanceRank: number | null;
  /**
   * Three-tier engagement bucket for `getRankingModelForEvent === "three-tier"`
   * events. Null for freeze-model events.
   */
  tier: LeaderboardEntryTier;
  /** True for three-tier-model entries within the attendance cap (top 200). */
  inAttendanceBand: boolean;
  /** True for three-tier-model entries within the credit cap (top 119). */
  inCreditBand: boolean;
  /**
   * True when the attendee has a PR open against the event's submissions
   * branch. Populated by a future PR (PR 2 in the rollout). Defaults false
   * for now so the field is present on all entries.
   */
  hasSubmission: boolean;
}

/** @internal */
export interface LeaderboardPayload {
  entries: LeaderboardEntry[];
  totalCount: number;
  websiteSignupCount: number;
  creditTopN: number;
  /**
   * Count of entries with attendingConfirmedAt set. 0 when the event
   * doesn't use the second-step attendance-confirmation flow.
   */
  confirmedAttendeeCount: number;
  /**
   * Per-event guaranteed-attendance cap. 0 when the event doesn't use the
   * second-step flow (in which case the new attendance fields on entries
   * are inert: attendingConfirmed=false, attendanceRank=null).
   */
  attendanceLimit: number;
}

/** @internal */
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

/** @internal */
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
    partifulRegistered: boolean;
    attendingConfirmedAt: number | null;
    attendingConfirmedBy: "user" | "admin" | null;
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

  // For three-tier events, fetch the submission-PR author set in parallel
  // with the PR-count fetches. Returns an empty set for any non-three-tier
  // event so the rest of the pipeline stays uniform.
  const wantsSubmissionLookup = getRankingModelForEvent(eventId) === "three-tier";

  const [githubMergedByLogin, firestoreMergedCounts, submissionAuthors] =
    await Promise.all([
      fetchMergedPrCountsForLogins(githubLogins, preloadedBulkPrCounts),
      userIdsWithoutGithub.length > 0
        ? countMergedCommunityPrsByUserIds(db, userIdsWithoutGithub)
        : Promise.resolve(new Map<string, number>()),
      wantsSubmissionLookup
        ? fetchSportsHack2026SubmissionAuthors()
        : Promise.resolve(new Set<string>()),
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
      partifulRegistered: false, // same — flipped true based on rsvpSource on the matched Luma doc
      attendingConfirmedAt: data.attendingConfirmedAt
        ? signedUpAtToMs(data.attendingConfirmedAt)
        : null,
      attendingConfirmedBy:
        data.attendingConfirmedBy === "user" || data.attendingConfirmedBy === "admin"
          ? data.attendingConfirmedBy
          : null,
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
    lumaRegistered: boolean;
    partifulRegistered: boolean;
  };
  const lumaRows: LumaRow[] = [];

  // The collection is named `hackathonLumaRegistrants` for historical reasons,
  // but as of 2026-05-24 it also holds Partiful "Going" rows merged in by
  // sync-may26-partiful-and-luma.ts. Each doc carries `rsvpSource: "partiful"
  // | "luma" | "partiful+luma"`. Map that into a pair of booleans so the
  // signup page can show "On Luma" / "On Partiful" / both as separate
  // indicators next to each attendee.
  function readExternalSources(rsvpSource: unknown): {
    luma: boolean;
    partiful: boolean;
  } {
    if (typeof rsvpSource !== "string") {
      // Pre-sync-script docs may lack rsvpSource; treat as Luma since that
      // was the only source historically. Backfilled correctly on the next
      // sync run.
      return { luma: true, partiful: false };
    }
    const parts = new Set(rsvpSource.split("+").map((s) => s.trim().toLowerCase()));
    return { luma: parts.has("luma"), partiful: parts.has("partiful") };
  }

  for (const doc of lumaSnap.docs) {
    const d = doc.data();
    const email = (d.email as string || "").toLowerCase();
    const ghLogin = typeof d.githubLogin === "string" ? d.githubLogin : null;
    if (judgeEmails.has(email) || declinedEmails.has(email)) continue;

    const sources = readExternalSources(d.rsvpSource);

    const matchIdx = websiteEmails.has(email)
      ? emailToRowIdx.get(email)
      : (ghLogin && websiteGithubLogins.has(ghLogin.toLowerCase()))
        ? ghLoginToRowIdx.get(ghLogin.toLowerCase())
        : undefined;
    if (matchIdx !== undefined) {
      // OR-merge — a website user can be on both lists, and each gets
      // sticky once seen. A second pass with a single-source doc won't
      // clear a flag set by an earlier pass.
      if (sources.luma) rows[matchIdx].lumaRegistered = true;
      if (sources.partiful) rows[matchIdx].partifulRegistered = true;
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
      lumaRegistered: sources.luma,
      partifulRegistered: sources.partiful,
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
    partifulRegistered: boolean;
    isCohort1: boolean;
    attendingConfirmedAt: number | null;
    attendingConfirmedBy: "user" | "admin" | null;
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
      partifulRegistered: r.partifulRegistered,
      isCohort1: email ? cohort1Emails.has(email) : false,
      attendingConfirmedAt: r.attendingConfirmedAt,
      attendingConfirmedBy: r.attendingConfirmedBy,
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
      lumaRegistered: lr.lumaRegistered,
      partifulRegistered: lr.partifulRegistered,
      isCohort1: email ? cohort1Emails.has(email) : false,
      // Luma-only rows have no website user account, so they cannot click
      // "Confirm attending" on the site. They acquire attendingConfirmedAt
      // only via admin door check-in (which writes through the website-signup
      // path when matched by email/github).
      attendingConfirmedAt: null,
      attendingConfirmedBy: null,
    });
  }

  const model = getRankingModelForEvent(eventId);
  const websiteCount = rows.length;
  const attendanceLimit = getAttendanceLimitForEvent(eventId);
  const creditCap = getConfirmedCapacityForEvent(eventId);

  // ---------------------------------------------------------------------------
  // Sort + shape — branched on the per-event ranking model.
  //
  // "freeze" (default) — historical 2-band model used by hack-a-sprint-2026.
  //   Order: cohort-1 boost → frozenRank (from freeze-confirmed-top50.ts) →
  //   PR count desc → signup time asc. Two bands split by `confirmedAt`.
  //
  // "three-tier" — sports-hack-2026 engagement-ladder model. Three tiers
  //   ordered by user action (claimed+user-confirmed → claimed → external-RSVP
  //   only). Within each tier: PR count desc → signup time asc. NO cohort-1
  //   boost (engagement, not prior membership). Cumulative cutoffs at the
  //   credit cap (top 119) and the attendance limit (top 200).
  // ---------------------------------------------------------------------------

  type SortedUnifiedRow = UnifiedRow & { _tier: LeaderboardEntryTier };
  let sorted: SortedUnifiedRow[];

  if (model === "three-tier") {
    const tierA: SortedUnifiedRow[] = [];
    const tierB: SortedUnifiedRow[] = [];
    const tierC: SortedUnifiedRow[] = [];
    for (const u of unified) {
      if (u.userId == null) {
        tierC.push({ ...u, _tier: "C" });
      } else if (
        u.attendingConfirmedAt != null &&
        u.attendingConfirmedBy === "user"
      ) {
        tierA.push({ ...u, _tier: "A" });
      } else {
        // Includes admin-only check-ins (attendingConfirmedBy === "admin") —
        // door check-in does NOT promote out of Tier B by design.
        tierB.push({ ...u, _tier: "B" });
      }
    }
    const tierSort = (a: SortedUnifiedRow, b: SortedUnifiedRow): number => {
      if (b.mergedPrCount !== a.mergedPrCount) {
        return b.mergedPrCount - a.mergedPrCount;
      }
      return a.signedUpAtMs - b.signedUpAtMs;
    };
    tierA.sort(tierSort);
    tierB.sort(tierSort);
    tierC.sort(tierSort);
    sorted = [...tierA, ...tierB, ...tierC];
  } else {
    const confirmed = unified
      .filter((u) => u.confirmedAt != null)
      .map((u): SortedUnifiedRow => ({ ...u, _tier: null }));
    const waitlisted = unified
      .filter((u) => u.confirmedAt == null)
      .map((u): SortedUnifiedRow => ({ ...u, _tier: null }));

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

    sorted = [...confirmed, ...waitlisted];
  }

  // First pass: build entries with attendance flags but without attendanceRank.
  const partialEntries: LeaderboardEntry[] = sorted.map((u, i) => {
    const rank = i + 1;
    const hasAttendanceFlow = attendanceLimit > 0;

    if (model === "three-tier") {
      const tier = u._tier;
      const inCreditBand = rank <= creditCap;
      const inAttendanceBand = rank <= attendanceLimit;
      const hasSubmission =
        u.githubLogin != null &&
        submissionAuthors.has(u.githubLogin.toLowerCase());
      const attendingConfirmed = u.attendingConfirmedAt != null;
      return {
        rank,
        userId: u.userId,
        displayName: u.displayName,
        githubLogin: u.githubLogin,
        // Three-tier events don't run the freeze script — always show live PRs.
        mergedPrCount: u.mergedPrCount,
        signedUpAt: u.signedUpAtIso,
        creditEligible: inCreditBand && hasSubmission,
        status: inAttendanceBand ? "confirmed" : "waitlisted",
        checkedIn: u.checkedInAt != null,
        willBeLate: u.willBeLate,
        queuingForSpot: u.queuingForSpot,
        lumaRegistered: u.lumaRegistered,
        partifulRegistered: u.partifulRegistered,
        isCohort1: u.isCohort1,
        attendingConfirmed,
        attendingConfirmedAt:
          u.attendingConfirmedAt != null
            ? new Date(u.attendingConfirmedAt).toISOString()
            : null,
        attendanceRank: null, // filled in below
        tier,
        inAttendanceBand,
        inCreditBand,
        hasSubmission,
      };
    }

    const isConfirmed = u.confirmedAt != null;
    const displayPrs =
      isConfirmed && u.frozenPrCount != null ? u.frozenPrCount : u.mergedPrCount;
    const attendingConfirmed = hasAttendanceFlow && u.attendingConfirmedAt != null;
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
      partifulRegistered: u.partifulRegistered,
      isCohort1: u.isCohort1,
      attendingConfirmed,
      attendingConfirmedAt:
        hasAttendanceFlow && u.attendingConfirmedAt != null
          ? new Date(u.attendingConfirmedAt).toISOString()
          : null,
      attendanceRank: null, // filled in below
      tier: null,
      inAttendanceBand: false,
      inCreditBand: false,
      hasSubmission: false,
    };
  });

  // Second pass: re-number confirmed-attending entries 1..N in existing rank
  // order. This deliberately does NOT re-sort by attendingConfirmedAt time —
  // a slow-to-RSVP top contributor cannot be pushed out by a fast-clicking
  // lower-ranked user. For three-tier events, the attendance subset is Tier A
  // (proactive confirms only) so that the public "Confirmed attending X/200"
  // reflects the pre-event headcount goal.
  let confirmedAttendeeCount = 0;
  if (attendanceLimit > 0) {
    let attendanceRank = 0;
    for (const entry of partialEntries) {
      const countsAsAttending =
        model === "three-tier"
          ? entry.tier === "A"
          : entry.attendingConfirmed;
      if (countsAsAttending) {
        attendanceRank += 1;
        entry.attendanceRank = attendanceRank;
        confirmedAttendeeCount += 1;
      }
    }
  }

  return {
    entries: partialEntries,
    totalCount: partialEntries.length,
    websiteSignupCount: websiteCount,
    creditTopN: creditCap,
    confirmedAttendeeCount,
    attendanceLimit,
  };
}

/**
 * Read the persisted snapshot for an event. Returns null if no snapshot has
 * been written yet (callers should fall through to {@link refreshSnapshot}).
 */
/** @internal */
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
  // Hydrate the new attendance fields for snapshots written before this
  // feature shipped. attendingConfirmed defaults to false, attendingConfirmedAt
  // to null, attendanceRank to null. Recomputation on the next mutation will
  // backfill the real values.
  const rawEntries = data.entries as Array<Record<string, unknown>>;
  const entries: LeaderboardEntry[] = rawEntries.map((e) => ({
    rank: typeof e.rank === "number" ? e.rank : 0,
    userId: (e.userId as string | null) ?? null,
    displayName: (e.displayName as string | null) ?? null,
    githubLogin: (e.githubLogin as string | null) ?? null,
    mergedPrCount: typeof e.mergedPrCount === "number" ? e.mergedPrCount : 0,
    signedUpAt: typeof e.signedUpAt === "string" ? e.signedUpAt : "",
    creditEligible: e.creditEligible === true,
    status: e.status === "confirmed" ? "confirmed" : "waitlisted",
    checkedIn: e.checkedIn === true,
    willBeLate: e.willBeLate === true,
    queuingForSpot: e.queuingForSpot === true,
    lumaRegistered: e.lumaRegistered === true,
    partifulRegistered: e.partifulRegistered === true,
    isCohort1: e.isCohort1 === true,
    attendingConfirmed: e.attendingConfirmed === true,
    attendingConfirmedAt:
      typeof e.attendingConfirmedAt === "string" ? e.attendingConfirmedAt : null,
    attendanceRank:
      typeof e.attendanceRank === "number" ? e.attendanceRank : null,
    // Three-tier fields — hydrate to safe defaults for snapshots written
    // before this feature shipped. Next mutation rebuilds with real values.
    tier:
      e.tier === "A" || e.tier === "B" || e.tier === "C"
        ? (e.tier as LeaderboardEntryTier)
        : null,
    inAttendanceBand: e.inAttendanceBand === true,
    inCreditBand: e.inCreditBand === true,
    hasSubmission: e.hasSubmission === true,
  }));
  return {
    entries,
    totalCount:
      typeof data.totalCount === "number" ? data.totalCount : entries.length,
    websiteSignupCount:
      typeof data.websiteSignupCount === "number" ? data.websiteSignupCount : 0,
    creditTopN:
      typeof data.creditTopN === "number"
        ? data.creditTopN
        : getConfirmedCapacityForEvent(eventId),
    confirmedAttendeeCount:
      typeof data.confirmedAttendeeCount === "number"
        ? data.confirmedAttendeeCount
        : entries.filter((e) => e.attendingConfirmed).length,
    attendanceLimit:
      typeof data.attendanceLimit === "number"
        ? data.attendanceLimit
        : getAttendanceLimitForEvent(eventId),
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
