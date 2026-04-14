/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Firestore } from "firebase-admin/firestore";
import { FieldPath } from "firebase-admin/firestore";

function isPlaceholderMemberId(id: string): boolean {
  return id.startsWith("mock-member-") || id.startsWith("mock-");
}

export interface PoolDashboardPublicUser {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  discord?: { username: string };
  github?: { login: string };
}

export interface PoolDashboardPoolEntry {
  userId: string;
  hackathonId: string;
  joinedAt: string | null;
}

export interface PoolDashboardTeam {
  id: string;
  hackathonId: string;
  memberIds: string[];
  name?: string;
  logoUrl?: string;
  wins?: number;
  createdBy: string;
  createdAt: string | null;
}

export interface PoolDashboardInvite {
  id: string;
  fromUserId: string;
  toUserId: string;
  teamId: string;
  status: string;
  createdAt: string | null;
  expiresAt?: string | null;
}

export interface PoolDashboardJoinRequest {
  id: string;
  fromUserId: string;
  teamId: string;
  status: string;
  createdAt: string | null;
}

export interface PoolDashboardPayload {
  poolEntries: PoolDashboardPoolEntry[];
  inPool: boolean;
  poolUsers: Record<string, PoolDashboardPublicUser>;
  myTeam: PoolDashboardTeam | null;
  teamsWithSlots: PoolDashboardTeam[];
  teamMemberProfiles: Record<string, PoolDashboardPublicUser>;
  successfulSubmissionsByTeam: Record<string, number>;
  myInvites: PoolDashboardInvite[];
  myInvitedUserIds: string[];
  requestsToMyTeam: PoolDashboardJoinRequest[];
  myPendingRequestTeamIds: string[];
}

function tsIso(v: unknown): string | null {
  if (v && typeof v === "object" && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
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

export async function loadHackathonPoolDashboard(
  db: Firestore,
  uid: string,
  hackathonId: string
): Promise<PoolDashboardPayload> {
  const poolSnap = await db
    .collection("hackathonPool")
    .where("hackathonId", "==", hackathonId)
    .orderBy("joinedAt", "desc")
    .get();

  const poolEntries: PoolDashboardPoolEntry[] = poolSnap.docs.map((d) => {
    const data = d.data();
    return {
      userId: data.userId as string,
      hackathonId: data.hackathonId as string,
      joinedAt: tsIso(data.joinedAt),
    };
  });

  const myPoolSnap = await db.collection("hackathonPool").doc(`${uid}_${hackathonId}`).get();
  const inPool = myPoolSnap.exists;

  const userIds = poolEntries.map((e) => e.userId).filter(Boolean);
  const poolUsers: Record<string, PoolDashboardPublicUser> = {};
  for (const ids of chunk(userIds, 10)) {
    if (ids.length === 0) continue;
    const usersSnap = await db.collection("users").where(FieldPath.documentId(), "in", ids).get();
    usersSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.visibility?.isPublic) {
        poolUsers[d.id] = {
          uid: d.id,
          displayName: data.displayName ?? null,
          photoURL: data.photoURL ?? null,
          discord: data.discord,
          github: data.github,
        };
      }
    });
  }

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

  const allTeamsSnap = await db
    .collection("hackathonTeams")
    .where("hackathonId", "==", hackathonId)
    .get();
  const teamsWithSlots: PoolDashboardTeam[] = allTeamsSnap.docs
    .map((d) => ({
      id: d.id,
      hackathonId: d.data().hackathonId as string,
      memberIds: d.data().memberIds as string[],
      name: d.data().name as string | undefined,
      logoUrl: d.data().logoUrl as string | undefined,
      wins: d.data().wins as number | undefined,
      createdBy: d.data().createdBy as string,
      createdAt: tsIso(d.data().createdAt),
    }))
    .filter((t) => t.memberIds.length >= 2 && t.memberIds.length < 3);

  const allTeamMemberIds = [...new Set(teamsWithSlots.flatMap((t) => t.memberIds))].filter(
    (id) => !isPlaceholderMemberId(id)
  );
  const teamMemberProfiles: Record<string, PoolDashboardPublicUser> = {};
  for (const ids of chunk(allTeamMemberIds, 10)) {
    if (ids.length === 0) continue;
    const usersSnap = await db.collection("users").where(FieldPath.documentId(), "in", ids).get();
    usersSnap.docs.forEach((d) => {
      const data = d.data();
      if (data.visibility?.isPublic) {
        teamMemberProfiles[d.id] = {
          uid: d.id,
          displayName: data.displayName ?? null,
          photoURL: data.photoURL ?? null,
          discord: data.discord,
          github: data.github,
        };
      }
    });
  }

  const subSnap = await db
    .collection("hackathonSubmissions")
    .where("hackathonId", "==", hackathonId)
    .get();
  const successfulSubmissionsByTeam: Record<string, number> = {};
  subSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.submittedAt && data.disqualified !== true && data.teamId) {
      const tid = data.teamId as string;
      successfulSubmissionsByTeam[tid] = (successfulSubmissionsByTeam[tid] ?? 0) + 1;
    }
  });

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

  const sentInvitesSnap = await db
    .collection("hackathonInvites")
    .where("fromUserId", "==", uid)
    .where("status", "==", "pending")
    .get();
  const myInvitedUserIds = sentInvitesSnap.docs
    .map((d) => d.data().toUserId as string)
    .filter(Boolean);

  let requestsToMyTeam: PoolDashboardJoinRequest[] = [];
  if (myTeam) {
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

  const myRequestsSnap = await db
    .collection("hackathonJoinRequests")
    .where("fromUserId", "==", uid)
    .where("status", "==", "pending")
    .get();
  const myPendingRequestTeamIds = myRequestsSnap.docs
    .map((d) => d.data().teamId as string)
    .filter(Boolean);

  return {
    poolEntries,
    inPool,
    poolUsers,
    myTeam,
    teamsWithSlots,
    teamMemberProfiles,
    successfulSubmissionsByTeam,
    myInvites,
    myInvitedUserIds,
    requestsToMyTeam,
    myPendingRequestTeamIds,
  };
}
