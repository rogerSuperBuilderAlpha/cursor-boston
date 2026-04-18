/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  computePublicMembersSnapshot,
  MEMBERS_SNAPSHOT_CACHE_TTL_MS,
} from "@/lib/members-public-snapshot";
import type { PublicMember } from "@/types/members";

export const runtime = "nodejs";

const REVALIDATE_SECONDS = 300;

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

async function loadPublicMembersFromSnapshot(): Promise<PublicMember[]> {
  const db = getAdminDb();
  if (!db) return [];

  let fallbackMembers: PublicMember[] = [];

  try {
    const snap = await db.collection("members_snapshots").doc("latest").get();
    if (snap.exists) {
      const data = snap.data();
      const members = data?.members;
      if (Array.isArray(members)) {
        fallbackMembers = members as PublicMember[];
        if (members.length > 0 && snapshotIsFresh(data)) {
          return fallbackMembers;
        }
      }
    }
  } catch (e) {
    console.error("[api/members/public] Failed to load members snapshot", e);
  }

  try {
    const members = await computePublicMembersSnapshot(db);
    await db.collection("members_snapshots").doc("latest").set({
      members,
      expiresAt: new Date(Date.now() + MEMBERS_SNAPSHOT_CACHE_TTL_MS),
      updatedAt: new Date(),
    });
    return members;
  } catch (e) {
    console.error("[api/members/public] Failed to rebuild members snapshot fallback", e);
    return fallbackMembers;
  }
}

export async function GET() {
  try {
    const members = await loadPublicMembersFromSnapshot();
    return NextResponse.json(
      { members },
      {
        headers: {
          "Cache-Control": `public, max-age=60, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=${REVALIDATE_SECONDS * 2}`,
        },
      }
    );
  } catch (e) {
    console.error("[api/members/public]", e);
    return NextResponse.json(
      { error: "Failed to load members" },
      { status: 500 }
    );
  }
}
