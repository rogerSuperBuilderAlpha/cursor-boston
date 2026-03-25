"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { GitHubIcon, DiscordIcon } from "@/components/icons";
import {
  CURSOR_CREDIT_TOP_N,
} from "@/lib/hackathon-event-signup";
import { HACK_A_SPRINT_2026_EVENT_ID } from "@/lib/hackathon-showcase";

type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string | null;
  githubLogin: string | null;
  mergedPrCount: number;
  signedUpAt: string;
  creditEligible: boolean;
};

type LeaderboardResponse = {
  eventId: string;
  totalCount: number;
  entries: LeaderboardEntry[];
  creditTopN: number;
  me: {
    signedUp: boolean;
    rank: number | null;
    mergedPrCount: number | null;
    signedUpAt: string | null;
    creditEligible: boolean;
  } | null;
};

type ProfileStatus = {
  hasGithub: boolean;
  githubUsername: string | null;
  hasDiscord: boolean;
  discordUsername: string | null;
  visibility: {
    isPublic?: boolean;
    showDiscord?: boolean;
  };
};

export default function HackASprint2026SignupPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [profile, setProfile] = useState<ProfileStatus | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [togglingDiscord, setTogglingDiscord] = useState(false);

  const eventId = HACK_A_SPRINT_2026_EVENT_ID;
  const apiUrl = `/api/hackathons/events/${eventId}/signup`;

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setProfileLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/profile/visibility", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setProfile(json.profile);
      }
    } catch {
      // Profile fetch is non-critical; requirements just won't show
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (user) {
        headers.Authorization = `Bearer ${await user.getIdToken()}`;
      }
      const res = await fetch(apiUrl, { headers });
      const json = (await res.json()) as LeaderboardResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Could not load leaderboard");
      }
      setData(json);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [apiUrl, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (user) void loadProfile();
  }, [user, loadProfile]);

  const isProfileReady =
    profile?.visibility?.isPublic === true &&
    profile?.hasGithub &&
    profile?.hasDiscord &&
    profile?.visibility?.showDiscord === true;

  const handleSignup = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Sign up failed");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!user) return;
    if (!window.confirm("Remove yourself from the website signup list?")) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(apiUrl, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Could not leave");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not leave");
    } finally {
      setBusy(false);
    }
  };

  const toggleVisibility = async (field: "isPublic" | "showDiscord") => {
    if (!user || !profile) return;
    const setter = field === "isPublic" ? setTogglingPublic : setTogglingDiscord;
    setter(true);
    try {
      const token = await user.getIdToken();
      const newValue = !profile.visibility?.[field];
      const res = await fetch("/api/profile/visibility", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ [field]: newValue }),
      });
      const json = await res.json();
      if (json.success) {
        setProfile({ ...profile, visibility: json.visibility });
      }
    } catch {
      // Silently fail; user can retry
    } finally {
      setter(false);
    }
  };

  const requirementsMet = [
    profile?.visibility?.isPublic === true,
    profile?.hasGithub === true,
    profile?.hasDiscord === true,
    profile?.visibility?.showDiscord === true,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <nav className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
          <Link href="/hackathons" className="hover:text-emerald-600 dark:hover:text-emerald-400">
            Hackathons
          </Link>
          <span className="mx-2">/</span>
          <Link
            href="/hackathons/hack-a-sprint-2026"
            className="hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            Hack-a-Sprint 2026
          </Link>
          <span className="mx-2">/</span>
          <span className="text-neutral-700 dark:text-neutral-300">Signup</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Hack-a-Sprint 2026 — website signup
        </h1>
        <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
          This page is the on-site signup list for Hack-a-Sprint 2026. It does not replace{" "}
          <a
            href="https://luma.com/uixo8hl6"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 underline hover:text-emerald-500 dark:text-emerald-400"
          >
            Luma registration
          </a>
          —you still need Luma for event admission. After that, claim a spot below so we
          can rank builders by merged PRs to cursor-boston, then by signup time, for
          invitations and the top-{CURSOR_CREDIT_TOP_N} Cursor credit band.
        </p>

        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-lg font-semibold text-foreground">How ranking works</h2>
          <ol className="mt-3 list-decimal list-inside space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
            <li>
              <strong>Merged PRs</strong> to{" "}
              <a
                href="https://github.com/rogerSuperBuilderAlpha/cursor-boston"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 underline dark:text-emerald-400"
              >
                cursor-boston
              </a>{" "}
              (higher first). Counts update as you merge more.
            </li>
            <li>
              <strong>Earlier website signups</strong> win ties (same PR count).
            </li>
            <li>
              The top {CURSOR_CREDIT_TOP_N} on this list are in the band eligible for{" "}
              <strong>$50 Cursor credit</strong> (subject to event selection and rules).
            </li>
          </ol>
        </div>

        <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 dark:bg-amber-500/10">
          <h2 className="text-lg font-semibold text-foreground">After the event — Cursor credit</h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Selected participants will claim <strong>$50 in Cursor credit</strong> after they{" "}
            <strong>merge their hackathon showcase PR</strong> to this repo. Official claim links
            and steps will be posted here when they are ready.
          </p>
        </div>

        {/* Profile requirements + signup action */}
        <div className="mt-10">
          {authLoading ? (
            <p className="text-sm text-neutral-500">Checking account…</p>
          ) : !user ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                Sign in or create an account to claim your spot on the list.
              </p>
              <div className="flex gap-3">
                <Link
                  href={`/login?redirect=${encodeURIComponent("/hackathons/hack-a-sprint-2026/signup")}`}
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400"
                >
                  Sign in
                </Link>
                <Link
                  href={`/signup?redirect=${encodeURIComponent("/hackathons/hack-a-sprint-2026/signup")}`}
                  className="inline-flex items-center justify-center rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-semibold hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
                >
                  Create account
                </Link>
              </div>
            </div>
          ) : data?.me?.signedUp ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 dark:bg-emerald-500/10">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">You are signed up.</span>{" "}
                  {data.me.rank != null && (
                    <>
                      Rank <strong>#{data.me.rank}</strong> of {data.totalCount} ·{" "}
                      <strong>{data.me.mergedPrCount ?? 0}</strong> merged PR
                      {(data.me.mergedPrCount ?? 0) !== 1 ? "s" : ""}
                      {data.me.creditEligible ? (
                        <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                          (top {CURSOR_CREDIT_TOP_N} — credit band)
                        </span>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void load()}
                    className="text-sm text-neutral-500 underline hover:text-neutral-700 dark:hover:text-neutral-300"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleLeave()}
                    className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
                  >
                    Leave list
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className="text-lg font-semibold text-foreground mb-1">Complete your profile to sign up</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-5">
                All four requirements must be met before you can claim your spot.
              </p>

              {profileLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-14 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                  ))}
                </div>
              ) : profile ? (
                <div className="space-y-3">
                  {/* Public profile */}
                  <div className={`flex items-center justify-between p-4 rounded-xl border ${
                    profile.visibility?.isPublic
                      ? "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10"
                      : "border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        profile.visibility?.isPublic ? "bg-emerald-500/20" : "bg-amber-500/10"
                      }`}>
                        {profile.visibility?.isPublic ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><polyline points="20 6 9 17 4 12" /></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">Public profile</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">Make your profile visible to others</p>
                      </div>
                    </div>
                    <button
                      onClick={() => void toggleVisibility("isPublic")}
                      disabled={togglingPublic}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        profile.visibility?.isPublic ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-600"
                      } ${togglingPublic ? "opacity-50" : ""}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        profile.visibility?.isPublic ? "left-6" : "left-1"
                      }`} />
                    </button>
                  </div>

                  {/* GitHub */}
                  <div className={`flex items-center justify-between p-4 rounded-xl border ${
                    profile.hasGithub
                      ? "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10"
                      : "border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        profile.hasGithub ? "bg-emerald-500/20" : "bg-amber-500/10"
                      }`}>
                        {profile.hasGithub ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><polyline points="20 6 9 17 4 12" /></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">GitHub connected</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {profile.hasGithub && profile.githubUsername
                            ? <>Connected as <span className="text-emerald-600 dark:text-emerald-400">@{profile.githubUsername}</span></>
                            : "Required to track your merged PRs"}
                        </p>
                      </div>
                    </div>
                    {profile.hasGithub ? (
                      <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                        <GitHubIcon size={16} />
                        @{profile.githubUsername}
                      </span>
                    ) : (
                      <a
                        href="/api/github/authorize"
                        className="inline-flex items-center gap-2 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 transition-colors dark:bg-neutral-700 dark:hover:bg-neutral-600"
                      >
                        <GitHubIcon size={16} />
                        Connect GitHub
                      </a>
                    )}
                  </div>

                  {/* Discord */}
                  <div className={`flex items-center justify-between p-4 rounded-xl border ${
                    profile.hasDiscord
                      ? "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10"
                      : "border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        profile.hasDiscord ? "bg-emerald-500/20" : "bg-amber-500/10"
                      }`}>
                        {profile.hasDiscord ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><polyline points="20 6 9 17 4 12" /></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">Discord connected</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {profile.hasDiscord && profile.discordUsername
                            ? <>Connected as <span className="text-emerald-600 dark:text-emerald-400">@{profile.discordUsername}</span></>
                            : "Required so organizers can reach you"}
                        </p>
                      </div>
                    </div>
                    {profile.hasDiscord ? (
                      <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                        <DiscordIcon size={16} />
                        @{profile.discordUsername}
                      </span>
                    ) : (
                      <a
                        href="/api/discord/authorize"
                        className="inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-medium text-white hover:bg-[#4752C4] transition-colors"
                      >
                        <DiscordIcon size={16} />
                        Connect Discord
                      </a>
                    )}
                  </div>

                  {/* Show Discord on profile */}
                  <div className={`flex items-center justify-between p-4 rounded-xl border ${
                    profile.visibility?.showDiscord
                      ? "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10"
                      : "border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        profile.visibility?.showDiscord ? "bg-emerald-500/20" : "bg-amber-500/10"
                      }`}>
                        {profile.visibility?.showDiscord ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><polyline points="20 6 9 17 4 12" /></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">Show Discord on profile</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {!profile.hasDiscord ? "Connect Discord first" : "Let others see your Discord handle"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => void toggleVisibility("showDiscord")}
                      disabled={togglingDiscord || !profile.hasDiscord}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        profile.visibility?.showDiscord ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-600"
                      } ${togglingDiscord || !profile.hasDiscord ? "opacity-50" : ""}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        profile.visibility?.showDiscord ? "left-6" : "left-1"
                      }`} />
                    </button>
                  </div>

                  {/* Progress + CTA */}
                  <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-neutral-500 dark:text-neutral-400">
                      {requirementsMet}/4 requirements met
                      <div className="mt-1.5 h-1.5 w-48 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${(requirementsMet / 4) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 items-center">
                      <button
                        type="button"
                        disabled={busy || !isProfileReady}
                        onClick={() => void handleSignup()}
                        className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!isProfileReady ? "Complete all requirements first" : undefined}
                      >
                        {busy ? "Working…" : "Claim my spot"}
                      </button>
                      <button
                        type="button"
                        disabled={busy || profileLoading}
                        onClick={() => { void loadProfile(); void load(); }}
                        className="text-sm text-neutral-500 underline hover:text-neutral-700 dark:hover:text-neutral-300"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-6 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-10">
          <h2 className="text-xl font-semibold">Leaderboard</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {data ? `${data.totalCount} signed up on the site` : "Loading…"}
          </p>

          <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-neutral-100 dark:bg-neutral-900/80">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">GitHub</th>
                  <th className="px-4 py-3 font-medium">Merged PRs</th>
                  <th className="px-4 py-3 font-medium">Signed up</th>
                  <th className="px-4 py-3 font-medium">Credit band</th>
                </tr>
              </thead>
              <tbody>
                {!data ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                      Loading…
                    </td>
                  </tr>
                ) : data.entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                      No one has signed up on the site yet. Be the first.
                    </td>
                  </tr>
                ) : (
                  data.entries.map((row) => {
                    const isYou = user && row.userId === user.uid;
                    return (
                      <tr
                        key={row.userId}
                        className={`border-t border-neutral-200 dark:border-neutral-800 ${
                          row.creditEligible ? "bg-cyan-500/5 dark:bg-cyan-500/10" : ""
                        } ${isYou ? "ring-2 ring-inset ring-emerald-500/50" : ""}`}
                      >
                        <td className="px-4 py-3 font-mono tabular-nums">{row.rank}</td>
                        <td className="px-4 py-3">
                          {row.displayName || "—"}
                          {isYou ? (
                            <span className="ml-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              (you)
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {row.githubLogin ? (
                            <a
                              href={`https://github.com/${row.githubLogin}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:underline dark:text-emerald-400"
                            >
                              @{row.githubLogin}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{row.mergedPrCount}</td>
                        <td className="px-4 py-3 text-neutral-500">
                          {new Date(row.signedUpAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          {row.creditEligible ? (
                            <span className="text-cyan-700 dark:text-cyan-400">Top {data.creditTopN}</span>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-10 text-xs text-neutral-500">
          Luma approval and capacity rules still apply. This list helps organizers prioritize invites
          and credit; it does not replace Luma.
        </p>
      </div>
    </div>
  );
}
