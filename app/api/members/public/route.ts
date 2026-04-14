/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import type { PublicMember } from "@/types/members";

export const runtime = "nodejs";

const REVALIDATE_SECONDS = 300;

async function loadPublicMembersFromSnapshot(): Promise<PublicMember[]> {
  const db = getAdminDb();
  if (!db) return [];

  try {
    const snap = await db.collection("members_snapshots").doc("latest").get();
    if (!snap.exists) return [];
    const data = snap.data();
    const members = data?.members;
    return Array.isArray(members) ? (members as PublicMember[]) : [];
  } catch {
    return [];
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
