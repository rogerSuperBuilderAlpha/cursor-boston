/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Firestore } from "firebase-admin/firestore";
import type { PublicMember, MemberType } from "@/types/members";

export const MEMBERS_SNAPSHOT_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours (aligned with analytics job)

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

/**
 * Full directory read — run only from snapshot rebuild (cron/CLI), not from public GET.
 */
export async function computePublicMembersSnapshot(db: Firestore): Promise<PublicMember[]> {
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
