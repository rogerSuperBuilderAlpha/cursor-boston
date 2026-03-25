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
  getHackathonEventSignupBlockReason,
  hackathonEventSignupDocId,
  isHackathonEventSignupId,
} from "@/lib/hackathon-event-signup";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE = { windowMs: 60 * 1000, maxRequests: 40 };

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
    }[] = [];

    const userIds = snap.docs.map((d) => d.data().userId as string).filter(Boolean);
    const userMap = await fetchUserDataMap(db, userIds);

    for (const doc of snap.docs) {
      const data = doc.data();
      const userId = data.userId as string;
      if (!userId) continue;
      const profile = userMap.get(userId);
      const pr =
        typeof profile?.pullRequestsCount === "number"
          ? profile.pullRequestsCount
          : 0;
      const gh =
        profile?.github && typeof profile.github === "object"
          ? (profile.github as { login?: string }).login
          : undefined;
      rows.push({
        userId,
        signedUpAtMs: signedUpAtToMs(data.signedUpAt),
        mergedPrCount: pr,
        displayName:
          typeof profile?.displayName === "string" ? profile.displayName : null,
        githubLogin: typeof gh === "string" ? gh : null,
      });
    }

    rows.sort((a, b) => {
      if (b.mergedPrCount !== a.mergedPrCount) {
        return b.mergedPrCount - a.mergedPrCount;
      }
      return a.signedUpAtMs - b.signedUpAtMs;
    });

    const entries = rows.map((r, i) => {
      const rank = i + 1;
      return {
        rank,
        userId: r.userId,
        displayName: r.displayName,
        githubLogin: r.githubLogin,
        mergedPrCount: r.mergedPrCount,
        signedUpAt: new Date(r.signedUpAtMs).toISOString(),
        creditEligible: rank <= CURSOR_CREDIT_TOP_N,
      };
    });

    let me: {
      signedUp: boolean;
      rank: number | null;
      mergedPrCount: number | null;
      signedUpAt: string | null;
      creditEligible: boolean;
    } | null = null;

    if (meUser) {
      const idx = rows.findIndex((r) => r.userId === meUser.uid);
      const signedUp = idx >= 0;
      const rank = signedUp ? idx + 1 : null;
      me = {
        signedUp,
        rank,
        mergedPrCount: signedUp ? rows[idx]!.mergedPrCount : null,
        signedUpAt: signedUp
          ? new Date(rows[idx]!.signedUpAtMs).toISOString()
          : null,
        creditEligible: signedUp && rank !== null && rank <= CURSOR_CREDIT_TOP_N,
      };
    }

    return NextResponse.json({
      eventId,
      totalCount: entries.length,
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
