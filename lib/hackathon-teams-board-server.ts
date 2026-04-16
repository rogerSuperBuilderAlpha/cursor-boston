/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Firestore } from "firebase-admin/firestore";
import { FieldPath } from "firebase-admin/firestore";

function tsIso(v: unknown): string | null {
  if (
    v &&
    typeof v === "object" &&
    "toDate" in v &&
    typeof (v as { toDate: () => Date }).toDate === "function"
  ) {
    const d = (v as { toDate: () => Date }).toDate();
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function isPlaceholderId(id: string): boolean {
  return id.startsWith("mock-member-") || id.startsWith("mock-");
}

export interface TeamsBoardTeam {
  id: string;
  hackathonId: string;
  memberIds: string[];
  name?: string;
  logoUrl?: string;
  wins?: number;
  createdBy: string;
  createdAt: string | null;
}

export interface TeamsBoardPublicUser {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
}

export interface TeamsBoardPayload {
  teams: TeamsBoardTeam[];
  memberProfiles: Record<string, TeamsBoardPublicUser>;
  successfulSubmissionsByTeam: Record<string, number>;
  myTeamId: string | null;
  inPool: boolean;
  myPendingRequestTeamIds: string[];
}

export async function loadHackathonTeamsBoard(
  db: Firestore,
  uid: string | null,
  hackathonId: string
): Promise<TeamsBoardPayload> {
  const teamsSnap = await db.collection("hackathonTeams").where("hackathonId", "==", hackathonId).limit(200).get();
  const teams: TeamsBoardTeam[] = teamsSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      hackathonId: data.hackathonId as string,
      memberIds: data.memberIds as string[],
      name: data.name as string | undefined,
      logoUrl: data.logoUrl as string | undefined,
      wins: data.wins as number | undefined,
      createdBy: data.createdBy as string,
      createdAt: tsIso(data.createdAt),
    };
  });

  const allMemberIds = [...new Set(teams.flatMap((t) => t.memberIds))].filter((id) => !isPlaceholderId(id));
  const memberProfiles: Record<string, TeamsBoardPublicUser> = {};
  for (const ids of chunk(allMemberIds, 10)) {
    if (ids.length === 0) continue;
    const usersSnap = await db.collection("users").where(FieldPath.documentId(), "in", ids).get();
    usersSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.visibility?.isPublic) {
        memberProfiles[d.id] = {
          uid: d.id,
          displayName: data.displayName ?? null,
          photoURL: data.photoURL ?? null,
        };
      }
    });
  }

  const subSnap = await db.collection("hackathonSubmissions").where("hackathonId", "==", hackathonId).limit(200).get();
  const successfulSubmissionsByTeam: Record<string, number> = {};
  subSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.submittedAt && data.disqualified !== true && data.teamId) {
      const tid = data.teamId as string;
      successfulSubmissionsByTeam[tid] = (successfulSubmissionsByTeam[tid] ?? 0) + 1;
    }
  });

  let myTeamId: string | null = null;
  let inPool = false;
  let myPendingRequestTeamIds: string[] = [];

  if (uid) {
    const mine = teams.find((t) => t.memberIds.includes(uid));
    myTeamId = mine?.id ?? null;
    const poolSnap = await db.collection("hackathonPool").doc(`${uid}_${hackathonId}`).get();
    inPool = poolSnap.exists;
    const reqSnap = await db
      .collection("hackathonJoinRequests")
      .where("fromUserId", "==", uid)
      .where("status", "==", "pending")
      .get();
    myPendingRequestTeamIds = reqSnap.docs.map((doc) => doc.data().teamId as string).filter(Boolean);
  }

  return {
    teams,
    memberProfiles,
    successfulSubmissionsByTeam,
    myTeamId,
    inPool,
    myPendingRequestTeamIds,
  };
}
