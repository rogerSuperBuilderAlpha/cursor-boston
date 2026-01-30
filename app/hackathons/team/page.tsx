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
  doc,
  updateDoc,
  Timestamp,
  documentId,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentVirtualHackathonId, getMonthEndFromVirtualId, isVirtualHackathonId } from "@/lib/hackathons";

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

interface PublicUser {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  discord?: { username: string };
  github?: { login: string };
}

interface HackathonInvite {
  id: string;
  fromUserId: string;
  toUserId: string;
  teamId: string;
  status: string;
  createdAt: Timestamp | { toDate: () => Date };
}

interface JoinRequest {
  id: string;
  fromUserId: string;
  teamId: string;
  status: string;
  createdAt: Timestamp | { toDate: () => Date };
}

interface Submission {
  id: string;
  hackathonId: string;
  teamId: string;
  repoUrl: string;
  registeredBy: string;
  registeredAt: Timestamp | { toDate: () => Date };
  submittedAt?: Timestamp | { toDate: () => Date };
  cutoffAt?: Date | { toISOString: () => string };
  disqualified?: boolean;
  disqualifiedReason?: string;
}

function getInitials(name: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name[0].toUpperCase();
  }
  return "?";
}

function HackathonsTeamPageContent() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const hackathonId = searchParams.get("hackathonId") || getCurrentVirtualHackathonId();
  const [myTeam, setMyTeam] = useState<HackathonTeam | null>(null);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, PublicUser>>({});
  const [myInvites, setMyInvites] = useState<HackathonInvite[]>([]);
  const [requestsToMyTeam, setRequestsToMyTeam] = useState<JoinRequest[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState<string | null>(null);
  const [decliningInvite, setDecliningInvite] = useState<string | null>(null);
  const [acceptingRequest, setAcceptingRequest] = useState<string | null>(null);
  const [decliningRequest, setDecliningRequest] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [registering, setRegistering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileLogoUrl, setProfileLogoUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchData = useCallback(async () => {
    if (!db || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const teamsRef = collection(db, "hackathonTeams");
      const myTeamQ = query(
        teamsRef,
        where("hackathonId", "==", hackathonId),
        where("memberIds", "array-contains", user.uid)
      );
      const myTeamSnap = await getDocs(myTeamQ);
      const teamDoc = myTeamSnap.docs[0];
      const team = teamDoc
        ? ({ id: teamDoc.id, ...teamDoc.data() } as HackathonTeam)
        : null;
      setMyTeam(team);
      if (team) {
        setProfileName(team.name ?? "");
        setProfileLogoUrl(team.logoUrl ?? "");
      } else {
        setProfileName("");
        setProfileLogoUrl("");
      }

      if (team) {
        const userIds = team.memberIds;
        const users: Record<string, PublicUser> = {};
        for (let i = 0; i < userIds.length; i += 10) {
          const chunk = userIds.slice(i, i + 10);
          const usersRef = collection(db, "users");
          const usersQ = query(usersRef, where(documentId(), "in", chunk));
          const usersSnap = await getDocs(usersQ);
          usersSnap.docs.forEach((d) => {
            const data = d.data();
            users[d.id] = {
              uid: d.id,
              displayName: data.displayName ?? null,
              photoURL: data.photoURL ?? null,
              discord: data.discord,
              github: data.github,
            };
          });
        }
        setMemberProfiles(users);

        const subRef = collection(db, "hackathonSubmissions");
        const subQ = query(
          subRef,
          where("hackathonId", "==", hackathonId),
          where("teamId", "==", team.id)
        );
        const subSnap = await getDocs(subQ);
        const subDoc = subSnap.docs[0];
        if (subDoc) {
          const data = subDoc.data();
          setSubmission({
            id: subDoc.id,
            hackathonId: data.hackathonId,
            teamId: data.teamId,
            repoUrl: data.repoUrl,
            registeredBy: data.registeredBy,
            registeredAt: data.registeredAt,
            submittedAt: data.submittedAt,
            cutoffAt: data.cutoffAt,
            disqualified: data.disqualified,
            disqualifiedReason: data.disqualifiedReason,
          });
          if (data.repoUrl) setRepoUrl(data.repoUrl);
        } else {
          setSubmission(null);
        }

        const invitesRef = collection(db, "hackathonInvites");
        const invitesQ = query(
          invitesRef,
          where("toUserId", "==", user.uid),
          where("status", "==", "pending")
        );
        const invitesSnap = await getDocs(invitesQ);
        setMyInvites(
          invitesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as HackathonInvite))
        );

        const reqRef = collection(db, "hackathonJoinRequests");
        const reqQ = query(
          reqRef,
          where("teamId", "==", team.id),
          where("status", "==", "pending")
        );
        const reqSnap = await getDocs(reqQ);
        setRequestsToMyTeam(
          reqSnap.docs.map((d) => ({ id: d.id, ...d.data() } as JoinRequest))
        );
      } else {
        setMemberProfiles({});
        setSubmission(null);
        setMyInvites(
          (await getDocs(
            query(
              collection(db, "hackathonInvites"),
              where("toUserId", "==", user.uid),
              where("status", "==", "pending")
            )
          )).docs.map((d) => ({ id: d.id, ...d.data() } as HackathonInvite))
        );
        setRequestsToMyTeam([]);
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

  const handleLeaveTeam = async () => {
    if (!myTeam || !user) return;
    if (!confirm("Leave this team? If the team had already registered a repo, the team will be disqualified and you cannot join another team until next month.")) return;
    setLeaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/hackathons/team/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ teamId: myTeam.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to leave");
      if (data.lockoutUntilNextMonth) {
        alert("You left. Your team is disqualified for this month. You cannot join another team until next month.");
      }
      await fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to leave team");
    } finally {
      setLeaving(false);
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    if (!user) return;
    setAcceptingInvite(inviteId);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/hackathons/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inviteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to accept");
      await fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to accept invite");
    } finally {
      setAcceptingInvite(null);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    if (!db) return;
    setDecliningInvite(inviteId);
    try {
      await updateDoc(doc(db, "hackathonInvites", inviteId), { status: "declined" });
      await fetchData();
    } catch (e) {
      console.error(e);
      alert("Failed to decline");
    } finally {
      setDecliningInvite(null);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    if (!user) return;
    setAcceptingRequest(requestId);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/hackathons/requests/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to accept");
      await fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to accept request");
    } finally {
      setAcceptingRequest(null);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    if (!db) return;
    setDecliningRequest(requestId);
    try {
      await updateDoc(doc(db, "hackathonJoinRequests", requestId), { status: "declined" });
      await fetchData();
    } catch (e) {
      console.error(e);
      alert("Failed to decline");
    } finally {
      setDecliningRequest(null);
    }
  };

  const handleRegisterRepo = async () => {
    if (!user || !repoUrl.trim()) return;
    setRegistering(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/hackathons/submissions/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ repoUrl: repoUrl.trim(), hackathonId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register");
      await fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to register repo");
    } finally {
      setRegistering(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/hackathons/submissions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ hackathonId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      await fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !myTeam) return;
    setSavingProfile(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/hackathons/team/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          teamId: myTeam.id,
          name: profileName.trim() || undefined,
          logoUrl: profileLogoUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      await fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">My team</h1>
        <p className="text-neutral-400 mb-6">Sign in to view and manage your team.</p>
        <Link
          href={`/login?redirect=${encodeURIComponent("/hackathons/team")}`}
          className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const monthEnd = getMonthEndFromVirtualId(hackathonId);
  const isVirtual = isVirtualHackathonId(hackathonId);
  const canRegister = myTeam && myTeam.memberIds.length === 3 && isVirtual;
  const canSubmit = canRegister && submission?.repoUrl && !submission.submittedAt;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link
          href="/hackathons"
          className="text-neutral-400 hover:text-white text-sm font-medium"
        >
          ← Hackathons
        </Link>
        <h1 className="text-3xl font-bold text-white mt-2">My team</h1>
        <p className="text-neutral-400 mt-1">
          Hackathon: <span className="text-white font-medium">{hackathonId}</span>
        </p>
      </div>

      {/* No team */}
      {!myTeam && (
        <section className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">You are not on a team</h2>
          <p className="text-neutral-400 mb-4">
            Join the pool to find teammates or get invited. You can also create a team from the pool (invite others to your team).
          </p>
          <Link
            href="/hackathons/pool"
            className="inline-block px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400"
          >
            Find a team
          </Link>
        </section>
      )}

      {/* My invites (when no team or have team) */}
      {myInvites.length > 0 && (
        <section className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">Invites to you</h2>
          <ul className="space-y-3">
            {myInvites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-4 py-2 border-b border-neutral-800 last:border-0">
                <span className="text-neutral-300 text-sm">Team {inv.teamId.slice(0, 8)}… invited you.</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAcceptInvite(inv.id)}
                    disabled={acceptingInvite === inv.id}
                    className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    {acceptingInvite === inv.id ? "Accepting…" : "Accept"}
                  </button>
                  <button
                    onClick={() => handleDeclineInvite(inv.id)}
                    disabled={decliningInvite === inv.id}
                    className="px-3 py-1.5 text-neutral-400 hover:text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    {decliningInvite === inv.id ? "…" : "Decline"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* My team */}
      {myTeam && (
        <>
          <section className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Team members ({myTeam.memberIds.length}/3)</h2>
            <ul className="space-y-3">
              {myTeam.memberIds.map((uid) => {
                const profile = memberProfiles[uid];
                return (
                  <li key={uid} className="flex items-center gap-3 py-2">
                    {profile?.photoURL ? (
                      <Image
                        src={profile.photoURL}
                        alt={profile.displayName || "Member"}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-white font-semibold">
                        {getInitials(profile?.displayName)}
                      </div>
                    )}
                    <div>
                      <p className="text-white font-medium">{profile?.displayName || "Anonymous"}</p>
                      {uid === user.uid && <span className="text-neutral-500 text-sm">(you)</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
            {myTeam.memberIds.length < 3 && (
              <p className="text-neutral-400 text-sm mt-4">
                <Link href="/hackathons/pool" className="text-emerald-400 hover:underline">
                  Invite from pool
                </Link>{" "}
                to fill your team.
              </p>
            )}
            <div className="mt-4 pt-4 border-t border-neutral-800">
              <button
                onClick={handleLeaveTeam}
                disabled={leaving}
                className="px-4 py-2 text-sm text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg disabled:opacity-50"
              >
                {leaving ? "Leaving…" : "Leave team"}
              </button>
            </div>
          </section>

          {/* Team profile (unlocked when wins >= 1) */}
          {(myTeam.wins ?? 0) >= 1 ? (
            <section className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 mb-8">
              <h2 className="text-lg font-semibold text-white mb-3">Team profile</h2>
              <p className="text-neutral-400 text-sm mb-4">
                Set a display name and logo for your team. These are shown on the teams list and pool.
              </p>
              <div className="space-y-3 max-w-md">
                <div>
                  <label htmlFor="team-name" className="block text-neutral-400 text-sm mb-1">
                    Team name
                  </label>
                  <input
                    id="team-name"
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="e.g. Full Stack Crew"
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label htmlFor="team-logo" className="block text-neutral-400 text-sm mb-1">
                    Logo URL
                  </label>
                  <input
                    id="team-logo"
                    type="url"
                    value={profileLogoUrl}
                    onChange={(e) => setProfileLogoUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50"
                >
                  {savingProfile ? "Saving…" : "Save profile"}
                </button>
              </div>
            </section>
          ) : (
            <section className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 mb-8">
              <h2 className="text-lg font-semibold text-white mb-3">Team profile</h2>
              <p className="text-neutral-400 text-sm">
                Win a hackathon to unlock a team profile and logo. Until then, your team is shown by its ID.
              </p>
            </section>
          )}

          {/* Requests to my team */}
          {requestsToMyTeam.length > 0 && (
            <section className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 mb-8">
              <h2 className="text-lg font-semibold text-white mb-3">Requests to join your team</h2>
              <ul className="space-y-3">
                {requestsToMyTeam.map((req) => (
                  <li key={req.id} className="flex items-center justify-between gap-4 py-2 border-b border-neutral-800 last:border-0">
                    <span className="text-neutral-300 text-sm">User {req.fromUserId.slice(0, 8)}… requested to join.</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptRequest(req.id)}
                        disabled={acceptingRequest === req.id}
                        className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-50"
                      >
                        {acceptingRequest === req.id ? "Accepting…" : "Accept"}
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(req.id)}
                        disabled={decliningRequest === req.id}
                        className="px-3 py-1.5 text-neutral-400 hover:text-white rounded-lg text-sm disabled:opacity-50"
                      >
                        {decliningRequest === req.id ? "…" : "Decline"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Virtual: register repo & submit */}
          {isVirtual && (
            <section className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 mb-8">
              <h2 className="text-lg font-semibold text-white mb-3">Virtual hackathon – submission</h2>
              <p className="text-neutral-400 text-sm mb-4">
                Repo must be public and created during this month. Period ends {monthEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
              </p>
              {submission?.repoUrl && (
                <p className="text-neutral-300 text-sm mb-2">
                  Registered repo:{" "}
                  <a href={submission.repoUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                    {submission.repoUrl}
                  </a>
                  {submission.submittedAt && (
                    <span className="text-emerald-400 ml-2">(submitted)</span>
                  )}
                  {submission.disqualified && (
                    <span className="text-red-400 ml-2">(disqualified: {submission.disqualifiedReason || "—"})</span>
                  )}
                </p>
              )}
              {canRegister && !submission?.submittedAt && !submission?.disqualified && (
                <div className="flex flex-wrap items-end gap-3 mt-3">
                  <div className="flex-1 min-w-[200px]">
                    <label htmlFor="repo-url" className="block text-neutral-400 text-sm mb-1">
                      GitHub repo URL
                    </label>
                    <input
                      id="repo-url"
                      type="url"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="https://github.com/owner/repo"
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                  <button
                    onClick={handleRegisterRepo}
                    disabled={registering || !repoUrl.trim()}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {registering ? "Registering…" : submission?.repoUrl ? "Update repo" : "Register repo"}
                  </button>
                </div>
              )}
              {canSubmit && (
                <div className="mt-4">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="px-4 py-2 bg-neutral-700 text-white rounded-lg text-sm font-medium hover:bg-neutral-600 disabled:opacity-50"
                  >
                    {submitting ? "Submitting…" : "Submit / lock"}
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default function HackathonsTeamPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white" />
        </div>
      }
    >
      <HackathonsTeamPageContent />
    </Suspense>
  );
}
