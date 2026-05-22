/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { MEMBERS_SNAPSHOT_CACHE_TTL_MS } from "@/lib/members-public-snapshot";
import type { PublicMember } from "@/types/members";

// @contracts: membersContract.publicList (lib/api-schemas/members.ts)

export const runtime = "nodejs";

const REVALIDATE_SECONDS = 300;
const cacheHeaders = {
  "Cache-Control": `public, max-age=60, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=${REVALIDATE_SECONDS * 2}`,
};

function snapshotTimeMs(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    const time = date.getTime();
    return Number.isNaN(time) ? null : time;
  }
  const parsed = new Date(String(value)).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function snapshotIsFresh(data: Record<string, unknown> | undefined): boolean {
  const expiresAtMs = snapshotTimeMs(data?.expiresAt);
  if (expiresAtMs !== null) return expiresAtMs > Date.now();

  const updatedAtMs = snapshotTimeMs(data?.updatedAt);
  return updatedAtMs !== null && Date.now() - updatedAtMs < MEMBERS_SNAPSHOT_CACHE_TTL_MS;
}

type PublicMembersSnapshotResult = {
  members: PublicMember[];
  isStale: boolean;
};

async function loadPublicMembersFromSnapshot(): Promise<PublicMembersSnapshotResult> {
  const db = getAdminDb();
  if (!db) return { members: [], isStale: false };

  try {
    const snap = await db.collection("members_snapshots").doc("latest").get();
    if (snap.exists) {
      const data = snap.data();
      const members = data?.members;
      if (Array.isArray(members)) {
        return {
          members: members as PublicMember[],
          isStale: !snapshotIsFresh(data),
        };
      }
    }
  } catch (e) {
    console.error("[api/members/public] Failed to load members snapshot", e);
  }

  return { members: [], isStale: false };
}

export async function GET() {
  try {
    const { members, isStale } = await loadPublicMembersFromSnapshot();
    const headers: Record<string, string> = { ...cacheHeaders };
    if (isStale) {
      headers["X-Members-Snapshot-Stale"] = "true";
    }

    return NextResponse.json(
      { members },
      { headers }
    );
  } catch (e) {
    console.error("[api/members/public]", e);
    return NextResponse.json(
      { error: "Failed to load members" },
      { status: 500 }
    );
  }
}
