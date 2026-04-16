/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentVirtualHackathonId } from "@/lib/hackathons";
import { HackathonPageSkeleton } from "@/components/skeletons/HackathonPageSkeleton";

type InviteStatus = "pending" | "accepted" | "declined";

interface PoolEntry {
  userId: string;
  hackathonId: string;
  joinedAt: Timestamp | { toDate: () => Date };
}

interface PublicUser {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  discord?: { username: string };
  github?: { login: string };
}

interface HackathonTeam {
  id: string;
  hackathonId: string;
  memberIds: string[];
  name?: string;
  logoUrl?: string;
  wins?: number;
  createdBy: string;
  createdAt: Timestamp | { toDate: () => Date };
}

function teamDisplayName(t: HackathonTeam): string {
  return (t.wins ?? 0) >= 1 && t.name ? t.name : `Team ${t.id.slice(0, 8)}`;
}

function formatTeamCreatedAt(createdAt: unknown): string {
  if (!createdAt) return "—";
  const date =
    typeof (createdAt as { toDate?: () => Date }).toDate === "function"
      ? (createdAt as { toDate: () => Date }).toDate()
      : createdAt instanceof Date
        ? createdAt
        : null;
  if (!date) return "—";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function isPlaceholderMemberId(id: string): boolean {
  return id.startsWith("mock-member-") || id.startsWith("mock-");
}

interface HackathonInvite {
  id: string;
  fromUserId: string;
  toUserId: string;
  teamId: string;
  status: InviteStatus;
  createdAt: Timestamp | { toDate: () => Date };
  expiresAt?: Timestamp | { toDate: () => Date };
}

interface JoinRequest {
  id: string;
  fromUserId: string;
  teamId: string;
  status: string;
  createdAt: Timestamp | { toDate: () => Date };
}

function getInitials(name: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name[0].toUpperCase();
  }
  return "?";
}

function HackathonsPoolPageContent() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const hackathonId = searchParams.get("hackathonId") || getCurrentVirtualHackathonId();
  const [poolEntries, setPoolEntries] = useState<PoolEntry[]>([]);
  const [poolUsers, setPoolUsers] = useState<Record<string, PublicUser>>({});
  const [myTeam, setMyTeam] = useState<HackathonTeam | null>(null);
  const [myInvites, setMyInvites] = useState<HackathonInvite[]>([]);
  const [requestsToMyTeam, setRequestsToMyTeam] = useState<JoinRequest[]>([]);
  const [teamsWithSlots, setTeamsWithSlots] = useState<HackathonTeam[]>([]);
  const [teamMemberProfiles, setTeamMemberProfiles] = useState<Record<string, PublicUser>>({});
  const [successfulSubmissionsByTeam, setSuccessfulSubmissionsByTeam] = useState<Record<string, number>>({});
  const [myPendingRequestTeamIds, setMyPendingRequestTeamIds] = useState<Set<string>>(new Set());
  const [myInvitedUserIds, setMyInvitedUserIds] = useState<Set<string>>(new Set());
  const [inPool, setInPool] = useState(false);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [eligibilityReason, setEligibilityReason] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);

  function tsFromIso(iso: string | null): Timestamp {
    if (!iso) return Timestamp.fromMillis(0);
    return Timestamp.fromDate(new Date(iso));
  }

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [dashRes, eligRes] = await Promise.all([
        fetch(
          `/api/hackathons/pool-dashboard?hackathonId=${encodeURIComponent(hackathonId)}`,
          { headers }
        ),
        fetch(`/api/hackathons/eligibility?hackathonId=${encodeURIComponent(hackathonId)}`, {
          headers,
        }),
      ]);

      if (!dashRes.ok) {
        throw new Error(`pool dashboard ${dashRes.status}`);
      }
      const d = (await dashRes.json()) as {
        poolEntries: Array<{ userId: string; hackathonId: string; joinedAt: string | null }>;
        inPool: boolean;
        poolUsers: Record<string, PublicUser>;
        myTeam: (Omit<HackathonTeam, "createdAt"> & { createdAt: string | null }) | null;
        teamsWithSlots: Array<Omit<HackathonTeam, "createdAt"> & { createdAt: string | null }>;
        teamMemberProfiles: Record<string, PublicUser>;
        successfulSubmissionsByTeam: Record<string, number>;
        myInvites: Array<
          Omit<HackathonInvite, "createdAt" | "expiresAt"> & {
            createdAt: string | null;
            expiresAt?: string | null;
          }
        >;
        myInvitedUserIds: string[];
        requestsToMyTeam: Array<
          Omit<JoinRequest, "createdAt"> & { createdAt: string | null }
        >;
        myPendingRequestTeamIds: string[];
      };

      setPoolEntries(
        d.poolEntries.map((e) => ({
          userId: e.userId,
          hackathonId: e.hackathonId,
          joinedAt: tsFromIso(e.joinedAt),
        }))
      );
      setInPool(d.inPool);
      setPoolUsers(d.poolUsers);
      setMyTeam(
        d.myTeam
          ? ({
              ...d.myTeam,
              createdAt: tsFromIso(d.myTeam.createdAt),
            } as HackathonTeam)
          : null
      );
      setTeamsWithSlots(
        d.teamsWithSlots.map(
          (t) =>
            ({
              ...t,
              createdAt: tsFromIso(t.createdAt),
            }) as HackathonTeam
        )
      );
      setTeamMemberProfiles(d.teamMemberProfiles);
      setSuccessfulSubmissionsByTeam(d.successfulSubmissionsByTeam);
      setMyInvites(
        d.myInvites.map(
          (inv) =>
            ({
              ...inv,
              createdAt: tsFromIso(inv.createdAt),
              expiresAt: inv.expiresAt ? tsFromIso(inv.expiresAt) : undefined,
            }) as HackathonInvite
        )
      );
      setMyInvitedUserIds(new Set(d.myInvitedUserIds));
      setRequestsToMyTeam(
        d.requestsToMyTeam.map(
          (r) =>
            ({
              ...r,
              createdAt: tsFromIso(r.createdAt),
            }) as JoinRequest
        )
      );
      setMyPendingRequestTeamIds(new Set(d.myPendingRequestTeamIds));

      if (eligRes.ok) {
        const e = (await eligRes.json()) as { eligible?: boolean; reason?: string };
        setEligible(e.eligible === true);
        setEligibilityReason(e.reason || "");
      } else {
        setEligible(false);
        setEligibilityReason("Could not check eligibility.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user, hackathonId]);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading && !user) setLoading(false);
      return;
    }
    fetchData();
  }, [authLoading, user, fetchData]);

  const handleJoinPool = async () => {
    if (!user) return;
    setJoining(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/hackathons/pool/join", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ hackathonId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join");
      setInPool(true);
      await fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to join pool");
    } finally {
      setJoining(false);
    }
  };

  const handleLeavePool = async () => {
    if (!db || !user) return;
    setLeaving(true);
    try {
      await deleteDoc(doc(db, "hackathonPool", `${user.uid}_${hackathonId}`));
      setInPool(false);
      await fetchData();
    } catch (e) {
      console.error(e);
      alert("Failed to leave pool");
    } finally {
      setLeaving(false);
    }
  };

  const handleInvite = async (toUserId: string) => {
    if (!db || !user) return;
    if (myTeam && myTeam.memberIds.length >= 3) return;
    setInviting(toUserId);
    setMyInvitedUserIds((prev) => new Set(prev).add(toUserId));
    try {
      let teamId = myTeam?.id;
      if (!teamId) {
        const teamRef = await addDoc(collection(db, "hackathonTeams"), {
          hackathonId,
          memberIds: [user.uid],
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          wins: 0,
        });
        teamId = teamRef.id;
        const newTeamId = teamRef.id;
        setMyTeam((prev) =>
          prev
            ? prev
            : ({
                id: newTeamId,
                hackathonId,
                memberIds: [user.uid],
                createdBy: user.uid,
                createdAt: { toDate: () => new Date() },
                wins: 0,
              } as HackathonTeam)
        );
      }
      await addDoc(collection(db, "hackathonInvites"), {
        fromUserId: user.uid,
        toUserId,
        teamId,
        status: "pending",
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      setMyInvitedUserIds((prev) => {
        const next = new Set(prev);
        next.delete(toUserId);
        return next;
      });
      alert("Failed to send invite");
    } finally {
      setInviting(null);
    }
  };

  const handleRequestToJoin = async (teamId: string) => {
    if (!db || !user) return;
    setRequesting(teamId);
    setMyPendingRequestTeamIds((prev) => new Set(prev).add(teamId));
    try {
      await addDoc(collection(db, "hackathonJoinRequests"), {
        fromUserId: user.uid,
        teamId,
        status: "pending",
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      setMyPendingRequestTeamIds((prev) => {
        const next = new Set(prev);
        next.delete(teamId);
        return next;
      });
      alert("Failed to send request");
    } finally {
      setRequesting(null);
    }
  };

  if (authLoading || loading) {
    return <HackathonPageSkeleton />;
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Find a team</h1>
        <p className="text-neutral-400 mb-6">
          Sign in to join the pool and find teammates for the hackathon.
        </p>
        <Link
          href={`/login?redirect=${encodeURIComponent("/hackathons/pool")}`}
          className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const poolList = poolEntries
    .map((e) => poolUsers[e.userId])
    .filter(Boolean) as PublicUser[];
  const canInvite = inPool && (myTeam ? myTeam.memberIds.length < 3 : true);
  const isMe = (uid: string) => uid === user.uid;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-6">
        <Link
          href="/hackathons"
          className="text-neutral-400 hover:text-white text-sm font-medium"
        >
          ← Hackathons
        </Link>
        <h1 className="text-3xl font-bold text-white mt-2">Find a team</h1>
        <p className="text-neutral-400 mt-1">
          Current virtual hackathon: <span className="text-white font-medium">{hackathonId}</span>
        </p>
      </div>

      {/* Compact Pool status bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-3 rounded-lg bg-neutral-900 border border-neutral-800">
        <span className="text-neutral-400 text-sm font-medium">Pool</span>
        {inPool ? (
          <>
            <span className="text-emerald-400 text-sm">You are in the pool.</span>
            <button
              onClick={handleLeavePool}
              disabled={leaving}
              className="ml-auto px-3 py-1.5 text-sm text-neutral-300 hover:text-white border border-neutral-600 rounded-lg disabled:opacity-50"
            >
              {leaving ? "Leaving…" : "Leave pool"}
            </button>
          </>
        ) : (
          <>
            {eligible === false && (
              <span className="text-amber-400 text-sm flex-1 min-w-0 truncate" title={eligibilityReason}>
                {eligibilityReason}
              </span>
            )}
            <Link
              href="/profile"
              className={eligible === false ? "inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm font-medium" : "hidden"}
            >
              Profile
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <button
              onClick={handleJoinPool}
              disabled={joining || eligible === false}
              className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {joining ? "Joining…" : "Join pool"}
            </button>
          </>
        )}
      </div>

      {/* Compact invites / requests strip */}
      {(myInvites.length > 0 || requestsToMyTeam.length > 0) && (
        <div className="flex flex-wrap gap-3 mb-6">
          {myInvites.length > 0 && (
            <div className="px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm">
              <span className="text-neutral-400">Invites: </span>
              <span className="text-neutral-300">{myInvites.length} team{myInvites.length !== 1 ? "s" : ""} invited you. </span>
              <Link href="/hackathons/team" className="text-emerald-400 hover:underline">Team page →</Link>
            </div>
          )}
          {requestsToMyTeam.length > 0 && (
            <div className="px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm">
              <span className="text-neutral-400">Requests: </span>
              <span className="text-neutral-300">{requestsToMyTeam.length} request{requestsToMyTeam.length !== 1 ? "s" : ""} to your team. </span>
              <Link href="/hackathons/team" className="text-emerald-400 hover:underline">Team page →</Link>
            </div>
          )}
        </div>
      )}

      {/* Two columns: People | Teams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: People in the pool */}
        <section className="bg-neutral-900 rounded-xl p-5 border border-neutral-800 min-h-[200px]">
          <h2 className="text-base font-semibold text-white mb-3">People in the pool</h2>
          {poolList.length === 0 ? (
            <p className="text-neutral-500 text-sm">No one in the pool yet. Be the first to join.</p>
          ) : (
            <ul className="space-y-3">
              {poolList.map((u) => (
                <li
                  key={u.uid}
                  className="flex items-center justify-between gap-3 py-2 border-b border-neutral-800 last:border-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {u.photoURL ? (
                      <Image
                        src={u.photoURL}
                        alt={u.displayName || "User"}
                        width={36}
                        height={36}
                        className="rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                        {getInitials(u.displayName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate">{u.displayName || "Anonymous"}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-neutral-500 text-xs">
                        {u.discord?.username && (
                          <span className="truncate">Discord: {u.discord.username}</span>
                        )}
                        {u.github?.login && (
                          <a
                            href={`https://github.com/${u.github.login}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:underline truncate"
                          >
                            @{u.github.login}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {isMe(u.uid) ? (
                      <span className="text-neutral-500 text-xs">(you)</span>
                    ) : myInvitedUserIds.has(u.uid) ? (
                      <span className="text-neutral-400 text-xs font-medium">Invited</span>
                    ) : canInvite ? (
                      <button
                        onClick={() => handleInvite(u.uid)}
                        disabled={inviting === u.uid}
                        className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium hover:bg-emerald-500/30 disabled:opacity-50"
                      >
                        {inviting === u.uid ? "…" : "Invite"}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Right: Teams with open slots */}
        <section className="bg-neutral-900 rounded-xl p-5 border border-neutral-800 min-h-[200px]">
          {teamsWithSlots.length > 0 && inPool ? (
            <>
              <h2 className="text-base font-semibold text-white mb-1">Teams with open slots</h2>
              <p className="text-neutral-500 text-xs mb-3">Request one team at a time.</p>
              <ul className="space-y-3">
            {teamsWithSlots
              .filter((t) => !myTeam || t.id !== myTeam.id)
              .filter((t) => !t.memberIds.includes(user.uid))
              .map((t) => {
                const hasRequested = myPendingRequestTeamIds.has(t.id);
                const slots = [0, 1, 2].map((i) => {
                  const mid = t.memberIds[i];
                  if (!mid) return { type: "open" as const };
                  if (isPlaceholderMemberId(mid)) return { type: "placeholder" as const };
                  const profile = teamMemberProfiles[mid];
                  if (profile) return { type: "member" as const, profile };
                  return { type: "placeholder" as const };
                });
                return (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-4 py-2 border-b border-neutral-800 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {(t.wins ?? 0) >= 1 && t.logoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.logoUrl}
                            alt={`${teamDisplayName(t)} logo`}
                            width={20}
                            height={20}
                            className="rounded-full object-cover w-5 h-5"
                          />
                        )}
                        <span className="text-neutral-300 text-sm">
                          {teamDisplayName(t)}… ({t.memberIds.length}/3)
                        </span>
                      </div>
                      <p className="text-neutral-500 text-xs mt-1">
                        Created {formatTeamCreatedAt(t.createdAt)}
                        {" · "}
                        {(successfulSubmissionsByTeam[t.id] ?? 0)} successful submission{(successfulSubmissionsByTeam[t.id] ?? 0) !== 1 ? "s" : ""}
                        {(t.wins ?? 0) > 0 && (
                          <> · {(t.wins ?? 0)} win{(t.wins ?? 0) !== 1 ? "s" : ""}</>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {slots.map((slot, idx) =>
                          slot.type === "member" ? (
                            <div
                              key={idx}
                              className="flex items-center gap-1 text-neutral-400 text-xs"
                            >
                              {slot.profile.photoURL ? (
                                <Image
                                  src={slot.profile.photoURL}
                                  alt={slot.profile.displayName || "Member"}
                                  width={20}
                                  height={20}
                                  className="rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-neutral-700 flex items-center justify-center text-white text-[10px] font-medium">
                                  {getInitials(slot.profile.displayName)}
                                </div>
                              )}
                              <span className="truncate max-w-[70px]">
                                {slot.profile.displayName || "Anonymous"}
                              </span>
                            </div>
                          ) : slot.type === "placeholder" ? (
                            <div key={idx} className="flex items-center gap-1 text-neutral-500 text-xs">
                              <div className="w-5 h-5 rounded-full bg-neutral-700 flex items-center justify-center text-white text-[10px] font-medium">
                                ?
                              </div>
                              <span>Member</span>
                            </div>
                          ) : (
                            <div key={idx} className="flex items-center gap-1 text-neutral-500 text-xs">
                              <div className="w-5 h-5 rounded-full bg-neutral-800 border border-dashed border-neutral-600 flex items-center justify-center text-[10px]">
                                +
                              </div>
                              <span>Open slot</span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                    {hasRequested ? (
                      <span className="text-neutral-400 text-sm font-medium shrink-0">Requested</span>
                    ) : (
                      <button
                        onClick={() => handleRequestToJoin(t.id)}
                        disabled={requesting === t.id}
                        className="px-2.5 py-1 bg-neutral-700 text-white rounded text-xs font-medium hover:bg-neutral-600 disabled:opacity-50 shrink-0"
                      >
                        {requesting === t.id ? "…" : "Request"}
                      </button>
                    )}
                  </li>
                );
              })}
              </ul>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-white mb-3">Teams with open slots</h2>
              <p className="text-neutral-500 text-sm">
                {inPool
                  ? "No teams with open slots right now."
                  : "Join the pool above to see and request teams with open slots."}
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default function HackathonsPoolPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white" />
        </div>
      }
    >
      <HackathonsPoolPageContent />
    </Suspense>
  );
}
