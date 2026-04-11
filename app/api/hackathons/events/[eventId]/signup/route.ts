/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  getVerifiedUser,
  getOptionalVerifiedUser,
} from "@/lib/server-auth";
import {
  CURSOR_CREDIT_TOP_N,
  DECLINED_EMAILS,
  JUDGE_EMAILS,
  getHackathonEventSignupBlockReason,
  hackathonEventSignupDocId,
  isHackathonEventSignupId,
} from "@/lib/hackathon-event-signup";
import { fetchMergedPrCountsForLogins } from "@/lib/github-merged-pr-count";
import { getGithubRepoPair } from "@/lib/github-recent-merged-prs";
import { checkRateLimit, getClientIdentifier, rateLimitConfigs } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE = rateLimitConfigs.hackathonEventSignup;

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
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const refs = chunk.map((id) => db.collection("users").doc(id));
    const snaps = await db.getAll(...refs);
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

  for (let i = 0; i < unique.length; i += USER_ID_IN_CHUNK) {
    const chunk = unique.slice(i, i + USER_ID_IN_CHUNK);
    const snap = await db
      .collection("pullRequests")
      .where("userId", "in", chunk)
      .where("state", "==", "merged")
      .get();

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

type RouteContext = { params: Promise<{ eventId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rate = checkRateLimit(`hackathon-event-signup-get:${clientId}`, RATE);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rate.retryAfter },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } }
      );
    }

    const { eventId: raw } = await context.params;
    const eventId = raw?.trim() ?? "";
    if (!isHackathonEventSignupId(eventId)) {
      return NextResponse.json({ error: "Unknown event" }, { status: 404 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const meUser = await getOptionalVerifiedUser(request);

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
      checkedInAt: number | null;
      willBeLate: boolean;
      queuingForSpot: boolean;
    }[] = [];

    const userIds = snap.docs.map((d) => d.data().userId as string).filter(Boolean);
    const userMap = await fetchUserDataMap(db, userIds);
    const firestoreMergedCounts = await countMergedCommunityPrsByUserIds(db, userIds);

    const githubLogins: string[] = [];
    for (const uid of userIds) {
      const profile = userMap.get(uid);
      const login =
        profile?.github && typeof profile.github === "object"
          ? (profile.github as { login?: string }).login
          : undefined;
      if (typeof login === "string" && login.trim()) githubLogins.push(login.trim());
    }
    const githubMergedByLogin = await fetchMergedPrCountsForLogins(githubLogins);

    for (const doc of snap.docs) {
      const data = doc.data();
      const userId = data.userId as string;
      if (!userId) continue;
      const profile = userMap.get(userId);
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
        checkedInAt: data.checkedInAt ? signedUpAtToMs(data.checkedInAt) : null,
        willBeLate: data.willBeLate === true,
        queuingForSpot: data.queuingForSpot === true,
      });
    }

    // Build a set of emails/logins already on the website list to deduplicate
    const websiteEmails = new Set<string>();
    const websiteGithubLogins = new Set<string>();
    for (const uid of userIds) {
      const profile = userMap.get(uid);
      if (typeof profile?.email === "string") websiteEmails.add(profile.email.toLowerCase());
      const gh = profile?.github && typeof profile.github === "object"
        ? (profile.github as { login?: string }).login : undefined;
      if (typeof gh === "string" && gh.trim()) websiteGithubLogins.add(gh.trim().toLowerCase());
    }

    // Fetch Luma-only registrants
    const lumaSnap = await db
      .collection("hackathonLumaRegistrants")
      .where("eventId", "==", eventId)
      .get();

    const lumaGithubLogins: string[] = [];
    type LumaRow = {
      name: string;
      githubLogin: string | null;
      lumaCreatedAt: string;
      mergedPrCount: number;
      confirmedAt: number | null;
    };
    const lumaRows: LumaRow[] = [];

    for (const doc of lumaSnap.docs) {
      const d = doc.data();
      const email = (d.email as string || "").toLowerCase();
      const ghLogin = typeof d.githubLogin === "string" ? d.githubLogin : null;
      if (JUDGE_EMAILS.has(email) || DECLINED_EMAILS.has(email)) continue;
      if (websiteEmails.has(email)) continue;
      if (ghLogin && websiteGithubLogins.has(ghLogin.toLowerCase())) continue;
      if (ghLogin) lumaGithubLogins.push(ghLogin);
      lumaRows.push({
        name: typeof d.name === "string" ? d.name : "",
        githubLogin: ghLogin,
        lumaCreatedAt: typeof d.lumaCreatedAt === "string" ? d.lumaCreatedAt : "",
        mergedPrCount: 0,
        confirmedAt: d.confirmedAt ? signedUpAtToMs(d.confirmedAt) : null,
      });
    }

    // Look up PR counts for Luma-only registrants
    if (lumaGithubLogins.length > 0) {
      const lumaPrCounts = await fetchMergedPrCountsForLogins(lumaGithubLogins);
      for (const lr of lumaRows) {
        if (lr.githubLogin) {
          const count = lumaPrCounts.get(lr.githubLogin.toLowerCase());
          if (count !== undefined) lr.mergedPrCount = count;
        }
      }
    }

    // Merge everything into one unified list, sorted by PR count then signup time
    type EntrySource = "website" | "luma_only";
    type UnifiedRow = {
      userId: string | null;
      displayName: string | null;
      githubLogin: string | null;
      mergedPrCount: number;
      signedUpAtMs: number;
      signedUpAtIso: string;
      source: EntrySource;
      confirmedAt: number | null;
      checkedInAt: number | null;
      willBeLate: boolean;
      queuingForSpot: boolean;
    };
    const unified: UnifiedRow[] = [];

    for (const r of rows) {
      unified.push({
        userId: r.userId,
        displayName: r.displayName,
        githubLogin: r.githubLogin,
        mergedPrCount: r.mergedPrCount,
        signedUpAtMs: r.signedUpAtMs,
        signedUpAtIso: new Date(r.signedUpAtMs).toISOString(),
        source: "website",
        confirmedAt: r.confirmedAt,
        checkedInAt: r.checkedInAt,
        willBeLate: r.willBeLate,
        queuingForSpot: r.queuingForSpot,
      });
    }
    for (const lr of lumaRows) {
      unified.push({
        userId: null,
        displayName: lr.name || null,
        githubLogin: lr.githubLogin,
        mergedPrCount: lr.mergedPrCount,
        signedUpAtMs: lr.lumaCreatedAt ? new Date(lr.lumaCreatedAt).getTime() : 0,
        signedUpAtIso: lr.lumaCreatedAt,
        source: "luma_only",
        confirmedAt: lr.confirmedAt,
        checkedInAt: null,
        willBeLate: false,
        queuingForSpot: false,
      });
    }

    // Confirmed first (frozen top 50), then waitlisted. Within each group: PRs desc → time asc.
    unified.sort((a, b) => {
      const aConf = a.confirmedAt != null ? 1 : 0;
      const bConf = b.confirmedAt != null ? 1 : 0;
      if (bConf !== aConf) return bConf - aConf;
      if (b.mergedPrCount !== a.mergedPrCount) return b.mergedPrCount - a.mergedPrCount;
      return a.signedUpAtMs - b.signedUpAtMs;
    });

    // Build ranked entries — status driven by confirmedAt field
    type EntryStatus = "confirmed" | "waitlisted";
    const websiteCount = rows.length;
    const entries = unified.map((u, i) => {
      const rank = i + 1;
      const isConfirmed = u.confirmedAt != null;
      return {
        rank,
        userId: u.userId,
        displayName: u.displayName,
        githubLogin: u.githubLogin,
        mergedPrCount: u.mergedPrCount,
        signedUpAt: u.signedUpAtIso,
        creditEligible: isConfirmed,
        status: (isConfirmed ? "confirmed" : "waitlisted") as EntryStatus,
        checkedIn: u.checkedInAt != null,
        willBeLate: u.willBeLate,
        queuingForSpot: u.queuingForSpot,
      };
    });

    let me: {
      signedUp: boolean;
      rank: number | null;
      mergedPrCount: number | null;
      signedUpAt: string | null;
      creditEligible: boolean;
      willBeLate: boolean;
      queuingForSpot: boolean;
    } | null = null;

    if (meUser) {
      const entry = entries.find((e) => e.userId === meUser.uid);
      me = entry
        ? {
            signedUp: true,
            rank: entry.rank,
            mergedPrCount: entry.mergedPrCount,
            signedUpAt: entry.signedUpAt,
            creditEligible: entry.creditEligible,
            willBeLate: entry.willBeLate,
            queuingForSpot: entry.queuingForSpot,
          }
        : {
            signedUp: false,
            rank: null,
            mergedPrCount: null,
            signedUpAt: null,
            creditEligible: false,
            willBeLate: false,
            queuingForSpot: false,
          };
    }

    return NextResponse.json({
      eventId,
      totalCount: entries.length,
      websiteSignupCount: websiteCount,
      entries,
      creditTopN: CURSOR_CREDIT_TOP_N,
      me,
    });
  } catch (e) {
    console.error("[hackathon event signup GET]", e);
    return NextResponse.json({ error: "Failed to load signups" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rate = checkRateLimit(`hackathon-event-signup-post:${clientId}`, RATE);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rate.retryAfter },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId: raw } = await context.params;
    const eventId = raw?.trim() ?? "";
    if (!isHackathonEventSignupId(eventId)) {
      return NextResponse.json({ error: "Unknown event" }, { status: 404 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const userRef = db.collection("users").doc(user.uid);
    const userSnap = await userRef.get();
    const block = getHackathonEventSignupBlockReason(userSnap.data());
    if (block) {
      return NextResponse.json({ error: block }, { status: 400 });
    }

    const docId = hackathonEventSignupDocId(eventId, user.uid);
    const ref = db.collection("hackathonEventSignups").doc(docId);
    const existing = await ref.get();
    if (existing.exists) {
      return NextResponse.json({ signedUp: true, alreadySignedUp: true }, { status: 200 });
    }

    await ref.set({
      eventId,
      userId: user.uid,
      signedUpAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ signedUp: true }, { status: 200 });
  } catch (e) {
    console.error("[hackathon event signup POST]", e);
    return NextResponse.json({ error: "Failed to sign up" }, { status: 500 });
  }
}

/**
 * PATCH RSVP flags on the user's own signup doc.
 * Body: { willBeLate?: boolean, queuingForSpot?: boolean, giveUpSpot?: true }
 * - willBeLate: only when confirmed (confirmedAt set)
 * - queuingForSpot: only when waitlisted (no confirmedAt)
 * - giveUpSpot: confirmed attendee releases their spot (clears confirmedAt)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rate = checkRateLimit(`hackathon-event-signup-patch:${clientId}`, RATE);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rate.retryAfter },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId: raw } = await context.params;
    const eventId = raw?.trim() ?? "";
    if (!isHackathonEventSignupId(eventId)) {
      return NextResponse.json({ error: "Unknown event" }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const docId = hackathonEventSignupDocId(eventId, user.uid);
    const ref = db.collection("hackathonEventSignups").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not signed up for this event" }, { status: 404 });
    }

    const data = snap.data() ?? {};
    const isConfirmed = Boolean(data.confirmedAt);

    if (body.giveUpSpot === true) {
      if (!isConfirmed) {
        return NextResponse.json(
          { error: "Only confirmed attendees can give up their spot" },
          { status: 400 }
        );
      }
      await ref.update({
        confirmedAt: FieldValue.delete(),
        gaveUpSpotAt: FieldValue.serverTimestamp(),
        willBeLate: FieldValue.delete(),
      });
      return NextResponse.json({ ok: true, gaveUpSpot: true }, { status: 200 });
    }

    const patch: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(body, "willBeLate")) {
      if (typeof body.willBeLate !== "boolean") {
        return NextResponse.json({ error: "willBeLate must be a boolean" }, { status: 400 });
      }
      if (body.willBeLate && !isConfirmed) {
        return NextResponse.json(
          { error: "Only confirmed attendees can mark that they will be late" },
          { status: 400 }
        );
      }
      if (body.willBeLate) {
        patch.willBeLate = true;
      } else {
        patch.willBeLate = FieldValue.delete();
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "queuingForSpot")) {
      if (typeof body.queuingForSpot !== "boolean") {
        return NextResponse.json({ error: "queuingForSpot must be a boolean" }, { status: 400 });
      }
      if (body.queuingForSpot && isConfirmed) {
        return NextResponse.json(
          { error: "Waitlisted attendees only can mark that they will queue for a spot" },
          { status: 400 }
        );
      }
      if (body.queuingForSpot) {
        patch.queuingForSpot = true;
      } else {
        patch.queuingForSpot = FieldValue.delete();
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    await ref.update(patch);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[hackathon event signup PATCH]", e);
    return NextResponse.json({ error: "Failed to update RSVP" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const clientId = getClientIdentifier(request as unknown as Request);
    const rate = checkRateLimit(`hackathon-event-signup-del:${clientId}`, RATE);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests", retryAfterSeconds: rate.retryAfter },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter || 60) } }
      );
    }

    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId: raw } = await context.params;
    const eventId = raw?.trim() ?? "";
    if (!isHackathonEventSignupId(eventId)) {
      return NextResponse.json({ error: "Unknown event" }, { status: 404 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const docId = hackathonEventSignupDocId(eventId, user.uid);
    await db.collection("hackathonEventSignups").doc(docId).delete().catch(() => undefined);

    return NextResponse.json({ left: true }, { status: 200 });
  } catch (e) {
    console.error("[hackathon event signup DELETE]", e);
    return NextResponse.json({ error: "Failed to leave list" }, { status: 500 });
  }
}
