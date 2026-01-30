"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentVirtualHackathonId } from "@/lib/hackathons";

interface HackathonTeam {
  id: string;
  hackathonId: string;
  memberIds: string[];
  name?: string;
  createdBy: string;
  createdAt: unknown;
}

function TeamsPageContent() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const hackathonId = searchParams.get("hackathonId") || getCurrentVirtualHackathonId();
  const [teams, setTeams] = useState<HackathonTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [inPool, setInPool] = useState(false);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
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

      if (user) {
        const myTeam = list.find((t) => t.memberIds.includes(user.uid));
        setMyTeamId(myTeam?.id ?? null);

        const poolRef = doc(db, "hackathonPool", `${user.uid}_${hackathonId}`);
        const poolSnap = await getDoc(poolRef);
        setInPool(poolSnap.exists());
      } else {
        setMyTeamId(null);
        setInPool(false);
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
                  const canRequest = user && inPool && !isMyTeam && !t.memberIds.includes(user.uid);
                  return (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-4 py-3 border-b border-neutral-800 last:border-0"
                    >
                      <div>
                        <span className="text-white font-medium">
                          {t.name || `Team ${t.id.slice(0, 8)}`}
                        </span>
                        <span className="text-neutral-500 text-sm ml-2">
                          {t.memberIds.length}/3 members · {openSlots} open slot{openSlots !== 1 ? "s" : ""}
                        </span>
                        {isMyTeam && (
                          <span className="text-emerald-400 text-sm ml-2">(your team)</span>
                        )}
                      </div>
                      {canRequest && (
                        <button
                          onClick={() => handleRequestToJoin(t.id)}
                          disabled={requesting === t.id}
                          className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-50"
                        >
                          {requesting === t.id ? "Sending…" : "Request to join"}
                        </button>
                      )}
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
              <ul className="space-y-2">
                {fullTeams.map((t) => {
                  const isMyTeam = t.id === myTeamId;
                  return (
                    <li
                      key={t.id}
                      className="flex items-center justify-between py-2 border-b border-neutral-800 last:border-0 text-neutral-400 text-sm"
                    >
                      <span>
                        {t.name || `Team ${t.id.slice(0, 8)}`} · 3/3
                        {isMyTeam && " (your team)"}
                      </span>
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
