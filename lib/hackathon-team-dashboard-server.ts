/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Firestore } from "firebase-admin/firestore";
import { FieldPath } from "firebase-admin/firestore";
import type {
  PoolDashboardInvite,
  PoolDashboardJoinRequest,
  PoolDashboardPublicUser,
  PoolDashboardTeam,
} from "@/lib/hackathon-pool-dashboard-server";

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

export interface TeamDashboardSubmissionJson {
  id: string;
  hackathonId: string;
  teamId: string;
  repoUrl: string;
  registeredBy: string;
  registeredAt: string | null;
  submittedAt?: string | null;
  cutoffAt?: string | null;
  disqualified?: boolean;
  disqualifiedReason?: string;
}

export interface TeamDashboardPayload {
  myTeam: PoolDashboardTeam | null;
  memberProfiles: Record<string, PoolDashboardPublicUser>;
  submission: TeamDashboardSubmissionJson | null;
  myInvites: PoolDashboardInvite[];
  requestsToMyTeam: PoolDashboardJoinRequest[];
}

export async function loadHackathonTeamDashboard(
  db: Firestore,
  uid: string,
  hackathonId: string
): Promise<TeamDashboardPayload> {
  const myTeamSnap = await db
    .collection("hackathonTeams")
    .where("hackathonId", "==", hackathonId)
    .where("memberIds", "array-contains", uid)
    .get();

  const teamDoc = myTeamSnap.docs[0];
  const myTeam: PoolDashboardTeam | null = teamDoc
    ? {
        id: teamDoc.id,
        hackathonId: teamDoc.data().hackathonId as string,
        memberIds: teamDoc.data().memberIds as string[],
        name: teamDoc.data().name as string | undefined,
        logoUrl: teamDoc.data().logoUrl as string | undefined,
        wins: teamDoc.data().wins as number | undefined,
        createdBy: teamDoc.data().createdBy as string,
        createdAt: tsIso(teamDoc.data().createdAt),
      }
    : null;

  const invitesSnap = await db
    .collection("hackathonInvites")
    .where("toUserId", "==", uid)
    .where("status", "==", "pending")
    .get();
  const myInvites: PoolDashboardInvite[] = invitesSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      fromUserId: data.fromUserId as string,
      toUserId: data.toUserId as string,
      teamId: data.teamId as string,
      status: data.status as string,
      createdAt: tsIso(data.createdAt),
      expiresAt: tsIso(data.expiresAt) ?? undefined,
    };
  });

  let memberProfiles: Record<string, PoolDashboardPublicUser> = {};
  let submission: TeamDashboardSubmissionJson | null = null;
  let requestsToMyTeam: PoolDashboardJoinRequest[] = [];

  if (myTeam) {
    const userIds = myTeam.memberIds;
    for (const ids of chunk(userIds, 10)) {
      if (ids.length === 0) continue;
      const usersSnap = await db.collection("users").where(FieldPath.documentId(), "in", ids).get();
      usersSnap.docs.forEach((d) => {
        const data = d.data();
        memberProfiles[d.id] = {
          uid: d.id,
          displayName: data.displayName ?? null,
          photoURL: data.photoURL ?? null,
          discord: data.discord,
          github: data.github,
        };
      });
    }

    const subSnap = await db
      .collection("hackathonSubmissions")
      .where("hackathonId", "==", hackathonId)
      .where("teamId", "==", myTeam.id)
      .limit(1)
      .get();
    const subDoc = subSnap.docs[0];
    if (subDoc) {
      const data = subDoc.data();
      submission = {
        id: subDoc.id,
        hackathonId: data.hackathonId as string,
        teamId: data.teamId as string,
        repoUrl: data.repoUrl as string,
        registeredBy: data.registeredBy as string,
        registeredAt: tsIso(data.registeredAt),
        submittedAt: tsIso(data.submittedAt) ?? undefined,
        cutoffAt: tsIso(data.cutoffAt) ?? undefined,
        disqualified: data.disqualified as boolean | undefined,
        disqualifiedReason: data.disqualifiedReason as string | undefined,
      };
    }

    const reqSnap = await db
      .collection("hackathonJoinRequests")
      .where("teamId", "==", myTeam.id)
      .where("status", "==", "pending")
      .get();
    requestsToMyTeam = reqSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        fromUserId: data.fromUserId as string,
        teamId: data.teamId as string,
        status: data.status as string,
        createdAt: tsIso(data.createdAt),
      };
    });
  }

  return { myTeam, memberProfiles, submission, myInvites, requestsToMyTeam };
}
