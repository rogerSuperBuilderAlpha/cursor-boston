/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { withMiddleware, rateLimitConfigs } from "@/lib/middleware";
import {
  PYDATA_2026_CAPACITY,
  PYDATA_2026_REGISTRATIONS_COLLECTION,
  type PydataRegistration,
  type PydataRegistrationStatus,
} from "@/lib/pydata-2026";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tsToMs(value: unknown): number | null {
  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

const VALID_STATUSES: ReadonlyArray<PydataRegistrationStatus> = [
  "awaiting-badge",
  "badge-ready",
  "checked-in",
  "cancelled",
];

async function handleGet(request: NextRequest) {
  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const snap = await db
    .collection(PYDATA_2026_REGISTRATIONS_COLLECTION)
    .orderBy("createdAt", "asc")
    .get();

  const registrations: PydataRegistration[] = snap.docs
    .map((doc) => {
      const data = doc.data() || {};
      const createdMs = tsToMs(data.createdAt);
      if (createdMs === null) return null;
      const updatedMs = tsToMs(data.updatedAt) ?? createdMs;
      const rawStatus = typeof data.status === "string" ? data.status : "awaiting-badge";
      const status: PydataRegistrationStatus = VALID_STATUSES.includes(
        rawStatus as PydataRegistrationStatus
      )
        ? (rawStatus as PydataRegistrationStatus)
        : "awaiting-badge";
      return {
        uid: doc.id,
        firstName: typeof data.firstName === "string" ? data.firstName : "",
        lastName: typeof data.lastName === "string" ? data.lastName : "",
        email: typeof data.email === "string" ? data.email : "",
        phone: typeof data.phone === "string" ? data.phone : "",
        organization: typeof data.organization === "string" ? data.organization : "",
        attendingConfirmed: true as const,
        status,
        createdAt: createdMs,
        updatedAt: updatedMs,
      };
    })
    .filter((r): r is PydataRegistration => r !== null);

  const counts = registrations.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<PydataRegistrationStatus, number>
  );

  // First PYDATA_2026_CAPACITY non-cancelled rows (already sorted createdAt asc)
  // are inside the cap; the rest are waitlist. Cancelled rows are skipped.
  const eligibleSorted = registrations.filter((r) => r.status !== "cancelled");
  const inCapEmails = new Set(
    eligibleSorted.slice(0, PYDATA_2026_CAPACITY).map((r) => r.email)
  );
  const inCapCount = inCapEmails.size;
  const waitlistCount = Math.max(0, eligibleSorted.length - inCapCount);

  return NextResponse.json({
    total: registrations.length,
    counts,
    capacity: PYDATA_2026_CAPACITY,
    inCapCount,
    waitlistCount,
    registrations: registrations.map((r) => ({
      ...r,
      inCap: inCapEmails.has(r.email),
    })),
  });
}

export const GET = withMiddleware(rateLimitConfigs.standard, handleGet);
