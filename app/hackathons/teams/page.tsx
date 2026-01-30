"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  addDoc,
  serverTimestamp,
  documentId,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentVirtualHackathonId } from "@/lib/hackathons";

interface HackathonTeam {
  id: string;
  hackathonId: string;
  memberIds: string[];
  name?: string;
  logoUrl?: string;
  createdBy: string;
  createdAt: unknown;
  wins?: number;
}

interface PublicUser {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
}

function getInitials(name: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name[0].toUpperCase();
  }
  return "?";
}

function isPlaceholderId(id: string): boolean {
  return id.startsWith("mock-member-") || id.startsWith("mock-");
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

function TeamsPageContent() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const hackathonId = searchParams.get("hackathonId") || getCurrentVirtualHackathonId();
  const [teams, setTeams] = useState<HackathonTeam[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, PublicUser>>({});
  const [successfulSubmissionsByTeam, setSuccessfulSubmissionsByTeam] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [inPool, setInPool] = useState(false);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [myPendingRequestTeamIds, setMyPendingRequestTeamIds] = useState<Set<string>>(new Set());
  const [requesting, setRequesting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!db) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const teamsRef = collection(db, "hackathonTeams");
      const q = query(teamsRef, where("hackathonId", "==", hackathonId));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as HackathonTeam));
      setTeams(list);

      const allMemberIds = [...new Set(list.flatMap((t) => t.memberIds))].filter(
        (id) => !isPlaceholderId(id)
      );
      const users: Record<string, PublicUser> = {};
      for (let i = 0; i < allMemberIds.length; i += 10) {
        const chunk = allMemberIds.slice(i, i + 10);
        if (chunk.length === 0) continue;
        const usersRef = collection(db, "users");
        const usersQ = query(usersRef, where(documentId(), "in", chunk));
        const usersSnap = await getDocs(usersQ);
        usersSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.visibility?.isPublic) {
            users[d.id] = {
              uid: d.id,
              displayName: data.displayName ?? null,
              photoURL: data.photoURL ?? null,
            };
          }
        });
      }
      setMemberProfiles(users);

      const submissionsRef = collection(db, "hackathonSubmissions");
      const subQ = query(
        submissionsRef,
        where("hackathonId", "==", hackathonId)
      );
      const subSnap = await getDocs(subQ);
      const counts: Record<string, number> = {};
      subSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.submittedAt && data.disqualified !== true && data.teamId) {
          counts[data.teamId] = (counts[data.teamId] ?? 0) + 1;
        }
      });
      setSuccessfulSubmissionsByTeam(counts);

      if (user) {
        const myTeam = list.find((t) => t.memberIds.includes(user.uid));
        setMyTeamId(myTeam?.id ?? null);

        const poolRef = doc(db, "hackathonPool", `${user.uid}_${hackathonId}`);
        const poolSnap = await getDoc(poolRef);
        setInPool(poolSnap.exists());

        const requestsRef = collection(db, "hackathonJoinRequests");
        const requestsQ = query(
          requestsRef,
          where("fromUserId", "==", user.uid),
          where("status", "==", "pending")
        );
        const requestsSnap = await getDocs(requestsQ);
        const teamIds = new Set(requestsSnap.docs.map((d) => d.data().teamId as string).filter(Boolean));
        setMyPendingRequestTeamIds(teamIds);
      } else {
        setMyTeamId(null);
        setInPool(false);
        setMyPendingRequestTeamIds(new Set());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [hackathonId, user]);

  useEffect(() => {
    if (authLoading) return;
    fetchData();
  }, [authLoading, fetchData]);

  const handleRequestToJoin = async (teamId: string) => {
    if (!db || !user) return;
    setRequesting(teamId);
    try {
      await addDoc(collection(db, "hackathonJoinRequests"), {
        fromUserId: user.uid,
        teamId,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      await fetchData();
    } catch (e) {
      console.error(e);
      alert("Failed to send request");
    } finally {
      setRequesting(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white" />
      </div>
    );
  }

  const teamsWithSlots = teams.filter((t) => t.memberIds.length < 3);
  const fullTeams = teams.filter((t) => t.memberIds.length === 3);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link
          href="/hackathons"
          className="text-neutral-400 hover:text-white text-sm font-medium"
        >
          ← Hackathons
        </Link>
        <h1 className="text-3xl font-bold text-white mt-2">Teams</h1>
        <p className="text-neutral-400 mt-1">
          Hackathon: <span className="text-white font-medium">{hackathonId}</span>
        </p>
      </div>

      <p className="text-neutral-400 mb-6">
        Teams of 3 can participate. Join the{" "}
        <Link href="/hackathons/pool" className="text-emerald-400 hover:underline">
          pool
        </Link>{" "}
        to invite others or request to join a team below.
      </p>

      {teams.length === 0 ? (
        <section className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
          <p className="text-neutral-500">No teams yet for this hackathon.</p>
          <p className="text-neutral-500 text-sm mt-2">
            Invite someone from the pool to form a team, or they can request to join once you have a team.
          </p>
          <Link
            href="/hackathons/pool"
            className="inline-block mt-4 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400"
          >
            Find a team
          </Link>
        </section>
      ) : (
        <>
          {teamsWithSlots.length > 0 && (
            <section className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 mb-8">
              <h2 className="text-lg font-semibold text-white mb-4">
                Teams with open slots ({teamsWithSlots.length})
              </h2>
              <ul className="space-y-4">
                {teamsWithSlots.map((t) => {
                  const openSlots = 3 - t.memberIds.length;
                  const isMyTeam = t.id === myTeamId;
                  const hasRequested = myPendingRequestTeamIds.has(t.id);
                  const canRequest = user && inPool && !isMyTeam && !t.memberIds.includes(user.uid) && !hasRequested;
                  const slots = [0, 1, 2].map((i) => {
                    const mid = t.memberIds[i];
                    if (!mid) return { type: "open" as const };
                    if (isPlaceholderId(mid)) return { type: "placeholder" as const };
                    const profile = memberProfiles[mid];
                    if (profile) return { type: "member" as const, profile };
                    return { type: "placeholder" as const };
                  });
                  return (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-4 py-3 border-b border-neutral-800 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {(t.wins ?? 0) >= 1 && t.logoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={t.logoUrl}
                              alt=""
                              width={28}
                              height={28}
                              className="rounded-full object-cover w-7 h-7"
                            />
                          )}
                          <span className="text-white font-medium">
                            {teamDisplayName(t)}
                          </span>
                          <span className="text-neutral-500 text-sm">
                            {t.memberIds.length}/3 members · {openSlots} open slot{openSlots !== 1 ? "s" : ""}
                          </span>
                          {isMyTeam && (
                            <span className="text-emerald-400 text-sm">(your team)</span>
                          )}
                        </div>
                        <p className="text-neutral-500 text-xs mt-1">
                          Created {formatTeamCreatedAt(t.createdAt)}
                          {" · "}
                          {(successfulSubmissionsByTeam[t.id] ?? 0)} successful submission{(successfulSubmissionsByTeam[t.id] ?? 0) !== 1 ? "s" : ""}
                          {(t.wins ?? 0) > 0 && (
                            <> · {(t.wins ?? 0)} win{(t.wins ?? 0) !== 1 ? "s" : ""}</>
                          )}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {slots.map((slot, idx) =>
                            slot.type === "member" ? (
                              <div
                                key={idx}
                                className="flex items-center gap-1.5 text-neutral-300 text-sm"
                              >
                                {slot.profile.photoURL ? (
                                  <Image
                                    src={slot.profile.photoURL}
                                    alt={slot.profile.displayName || "Member"}
                                    width={24}
                                    height={24}
                                    className="rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center text-white text-xs font-medium">
                                    {getInitials(slot.profile.displayName)}
                                  </div>
                                )}
                                <span className="truncate max-w-[100px]">
                                  {slot.profile.displayName || "Anonymous"}
                                </span>
                              </div>
                            ) : (
                              <div
                                key={idx}
                                className="flex items-center gap-1.5 text-neutral-500 text-sm"
                              >
                                <div className="w-6 h-6 rounded-full bg-neutral-800 border border-dashed border-neutral-600 flex items-center justify-center text-neutral-500 text-xs">
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
                      ) : canRequest ? (
                        <button
                          onClick={() => handleRequestToJoin(t.id)}
                          disabled={requesting === t.id}
                          className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-50 shrink-0"
                        >
                          {requesting === t.id ? "Sending…" : "Request to join"}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {fullTeams.length > 0 && (
            <section className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
              <h2 className="text-lg font-semibold text-white mb-4">
                Full teams ({fullTeams.length})
              </h2>
              <ul className="space-y-3">
                {fullTeams.map((t) => {
                  const isMyTeam = t.id === myTeamId;
                  const slots = [0, 1, 2].map((i) => {
                    const mid = t.memberIds[i];
                    if (!mid) return { type: "open" as const };
                    if (isPlaceholderId(mid)) return { type: "placeholder" as const };
                    const profile = memberProfiles[mid];
                    if (profile) return { type: "member" as const, profile };
                    return { type: "placeholder" as const };
                  });
                  return (
                    <li
                      key={t.id}
                      className="flex items-center justify-between py-2 border-b border-neutral-800 last:border-0"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          {(t.wins ?? 0) >= 1 && t.logoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={t.logoUrl}
                              alt=""
                              width={24}
                              height={24}
                              className="rounded-full object-cover w-6 h-6"
                            />
                          )}
                          <span className="text-white font-medium">
                            {teamDisplayName(t)}
                          </span>
                        </div>
                        <span className="text-neutral-500 text-sm ml-2">3/3</span>
                        {isMyTeam && (
                          <span className="text-emerald-400 text-sm ml-2">(your team)</span>
                        )}
                        <p className="text-neutral-500 text-xs mt-1">
                          Created {formatTeamCreatedAt(t.createdAt)}
                          {" · "}
                          {(successfulSubmissionsByTeam[t.id] ?? 0)} successful submission{(successfulSubmissionsByTeam[t.id] ?? 0) !== 1 ? "s" : ""}
                          {(t.wins ?? 0) > 0 && (
                            <> · {(t.wins ?? 0)} win{(t.wins ?? 0) !== 1 ? "s" : ""}</>
                          )}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {slots.map((slot, idx) =>
                            slot.type === "member" ? (
                              <div
                                key={idx}
                                className="flex items-center gap-1.5 text-neutral-400 text-sm"
                              >
                                {slot.profile.photoURL ? (
                                  <Image
                                    src={slot.profile.photoURL}
                                    alt={slot.profile.displayName || "Member"}
                                    width={22}
                                    height={22}
                                    className="rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-[22px] h-[22px] rounded-full bg-neutral-700 flex items-center justify-center text-white text-xs font-medium">
                                    {getInitials(slot.profile.displayName)}
                                  </div>
                                )}
                                <span className="truncate max-w-[90px]">
                                  {slot.profile.displayName || "Anonymous"}
                                </span>
                              </div>
                            ) : (
                              <div key={idx} className="flex items-center gap-1.5 text-neutral-500 text-sm">
                                <div className="w-[22px] h-[22px] rounded-full bg-neutral-800 border border-dashed border-neutral-600 flex items-center justify-center text-xs">
                                  +
                                </div>
                                <span>Open slot</span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default function HackathonsTeamsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white" />
        </div>
      }
    >
      <TeamsPageContent />
    </Suspense>
  );
}
