/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getAdminDb } from "@/lib/firebase-admin";
import type { PublicMember, MemberType } from "@/types/members";

export const runtime = "nodejs";

const CACHE_TAG = "public-members-directory-v1";
const REVALIDATE_SECONDS = 300;

function toPlainJson(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    const d = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (Array.isArray(value)) return value.map(toPlainJson);
  if (typeof value === "object" && value !== null) {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      out[k] = toPlainJson(v);
    }
    return out;
  }
  return value;
}

async function loadPublicMembersFromFirestore(): Promise<PublicMember[]> {
  const db = getAdminDb();
  if (!db) return [];

  const [usersSnap, agentsSnap] = await Promise.all([
    db
      .collection("users")
      .where("visibility.isPublic", "==", true)
      .orderBy("createdAt", "desc")
      .get(),
    db
      .collection("agents")
      .where("visibility.isPublic", "==", true)
      .where("status", "==", "claimed")
      .orderBy("createdAt", "desc")
      .get(),
  ]);

  const humanMembers = usersSnap.docs.map((doc) => {
    const merged = {
      uid: doc.id,
      memberType: "human" as MemberType,
      ...(doc.data() as Record<string, unknown>),
    };
    return toPlainJson(merged) as PublicMember;
  });

  const agentMembers = agentsSnap.docs.map((doc) => {
    const data = doc.data();
    const merged = {
      uid: doc.id,
      memberType: "agent" as MemberType,
      displayName: data.name,
      photoURL: data.avatarUrl || null,
      bio: data.description,
      visibility: {
        ...data.visibility,
        showBio: true,
        showMemberSince: true,
      },
      createdAt: data.createdAt,
      owner: data.visibility?.showOwner
        ? {
            displayName: data.ownerDisplayName,
            email: data.ownerEmail,
          }
        : undefined,
    };
    return toPlainJson(merged) as PublicMember;
  });

  return [...humanMembers, ...agentMembers].sort((a, b) => {
    const ta =
      typeof a.createdAt === "string"
        ? new Date(a.createdAt).getTime()
        : a.createdAt?.toDate?.()?.getTime() || 0;
    const tb =
      typeof b.createdAt === "string"
        ? new Date(b.createdAt).getTime()
        : b.createdAt?.toDate?.()?.getTime() || 0;
    return tb - ta;
  });
}

const getCachedPublicMembers = unstable_cache(
  () => loadPublicMembersFromFirestore(),
  [CACHE_TAG],
  { revalidate: REVALIDATE_SECONDS }
);

export async function GET() {
  try {
    const members = await getCachedPublicMembers();
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
