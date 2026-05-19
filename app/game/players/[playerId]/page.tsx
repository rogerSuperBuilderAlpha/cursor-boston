/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Caste, PlayerTitle } from "@/lib/game/types";

interface PublicPlayer {
  userId: string;
  displayName: string;
  caste: Caste | null;
  phase: string;
  tilesExplored: number;
  stats?: {
    attacksWon: number;
    attacksLost: number;
    tilesHeld: number;
    unitsAlive: number;
  };
  heroCount: number;
  armageddonSealsBroken: number;
  seasonNumber: number;
  bio: string;
  bioUpdatedAt: { seconds: number } | string | null;
}

interface ProfileResponse {
  success: boolean;
  player?: PublicPlayer;
  titles?: PlayerTitle[];
  error?: { message?: string } | string;
}

interface PactRow {
  id: string;
  authorId: string;
  authorDisplayName: string;
  targetId: string;
  targetDisplayName: string;
  statement: string;
  createdAt: string | { seconds: number };
  expiresAt: string | { seconds: number };
  brokenAt?: string | { seconds: number };
}

const CASTE_SWATCH: Record<Caste, string> = {
  white: "#e5e7eb",
  blue: "#60a5fa",
  black: "#a78bfa",
  red: "#f87171",
  green: "#4ade80",
};

const MAX_BIO_LENGTH = 500;

export default function PlayerProfilePage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const [player, setPlayer] = useState<PublicPlayer | null>(null);
  const [titles, setTitles] = useState<PlayerTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [draftBio, setDraftBio] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [pacts, setPacts] = useState<PactRow[]>([]);
  const [pactDraft, setPactDraft] = useState("");
  const [filingPact, setFilingPact] = useState(false);

  const isOwnProfile = user?.uid === playerId;

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/game/players/${playerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as ProfileResponse;
      if (!data.success) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Failed to load profile";
        throw new Error(msg);
      }
      setPlayer(data.player ?? null);
      setTitles(data.titles ?? []);
      setDraftBio(data.player?.bio ?? "");
      const pactsRes = await fetch(
        `/api/game/pacts?playerId=${encodeURIComponent(playerId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const pactsData = await pactsRes.json();
      if (pactsData.success) setPacts(pactsData.pacts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [user, playerId]);

  const filePact = useCallback(async () => {
    if (!user) return;
    const statement = pactDraft.trim();
    if (!statement) return;
    setFilingPact(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/game/pacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetId: playerId, statement }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Failed to file pact"
        );
      }
      setPactDraft("");
      await fetchProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to file pact");
    } finally {
      setFilingPact(false);
    }
  }, [user, pactDraft, playerId, fetchProfile]);

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, state set inside async callback
    fetchProfile();
  }, [authLoading, fetchProfile]);

  const saveBio = useCallback(async () => {
    if (!user) return;
    setSavingBio(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/game/players/me/bio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bio: draftBio }),
      });
      const data = await res.json();
      if (!data.success) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Failed to save bio";
        throw new Error(msg);
      }
      setEditingBio(false);
      await fetchProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save bio");
    } finally {
      setSavingBio(false);
    }
  }, [user, draftBio, fetchProfile]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <Link
          href="/login"
          className="px-6 py-3 bg-emerald-500 text-white rounded-lg"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/game/leaderboard"
            className="text-sm text-neutral-500 hover:text-neutral-700"
          >
            ← Leaderboard
          </Link>
          <p className="mt-8 text-center text-neutral-500">
            {error ?? "General not found."}
          </p>
        </div>
      </div>
    );
  }

  const swatch = player.caste ? CASTE_SWATCH[player.caste] : "#737373";

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <Link
            href="/game/leaderboard"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Leaderboard
          </Link>
          <Link
            href="/game"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            Dashboard →
          </Link>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <header className="mb-8 flex items-center gap-4">
          <span
            className="inline-block h-5 w-5 shrink-0 rounded-full border border-neutral-300 dark:border-neutral-700"
            style={{ background: swatch }}
            aria-hidden="true"
          />
          <div>
            <h1 className="text-3xl font-bold capitalize">
              {player.displayName || "Unnamed general"}
              {isOwnProfile && (
                <span className="ml-2 text-sm font-normal text-neutral-500">
                  (you)
                </span>
              )}
            </h1>
            <p className="text-sm text-neutral-500 capitalize">
              {player.caste ? `${player.caste} caste` : "no caste yet"}
              {player.seasonNumber > 1 && ` · season ${player.seasonNumber}`}
            </p>
          </div>
        </header>

        <section className="mb-8 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Bio
            </h2>
            {isOwnProfile && !editingBio && (
              <button
                type="button"
                onClick={() => setEditingBio(true)}
                className="text-xs text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
              >
                Edit
              </button>
            )}
          </div>
          {editingBio ? (
            <div>
              <textarea
                value={draftBio}
                onChange={(e) =>
                  setDraftBio(e.target.value.slice(0, MAX_BIO_LENGTH))
                }
                rows={5}
                placeholder="A few sentences about your general, your strategy, your war record…"
                className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
                maxLength={MAX_BIO_LENGTH}
              />
              <div className="mt-2 flex items-center justify-between">
                <span
                  className={`text-[11px] ${
                    MAX_BIO_LENGTH - draftBio.length < 50
                      ? "text-amber-600"
                      : "text-neutral-500"
                  }`}
                >
                  {MAX_BIO_LENGTH - draftBio.length} chars left
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBio(false);
                      setDraftBio(player.bio ?? "");
                    }}
                    className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveBio}
                    disabled={savingBio}
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingBio ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          ) : player.bio ? (
            <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-200">
              {player.bio}
            </p>
          ) : (
            <p className="text-sm text-neutral-500 italic">
              {isOwnProfile
                ? "No bio yet. Click Edit to add one."
                : "This general hasn't written a bio."}
            </p>
          )}
        </section>

        {titles.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Titles
            </h2>
            <ul className="flex flex-wrap gap-2">
              {titles.map((t) => (
                <li
                  key={t.id}
                  className="rounded-full border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 text-xs"
                  title={t.description}
                >
                  {t.label}
                </li>
              ))}
            </ul>
          </section>
        )}

        {pacts.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Pacts
            </h2>
            <ul className="space-y-2">
              {pacts.map((p) => (
                <li
                  key={p.id}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    p.brokenAt
                      ? "border-red-300 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20"
                      : "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/10"
                  }`}
                >
                  <p className="italic">&ldquo;{p.statement}&rdquo;</p>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    <strong className="capitalize">{p.authorDisplayName}</strong>
                    {" → "}
                    <strong className="capitalize">{p.targetDisplayName}</strong>
                    {p.brokenAt ? " · BROKEN" : " · active"}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!isOwnProfile && user && (
          <section className="mb-8 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              File a pact
            </h2>
            <p className="mb-2 text-xs text-neutral-500">
              Publish a non-aggression statement aimed at this general. No
              enforcement — if you attack them while it&apos;s active, a
              &ldquo;pact broken&rdquo; event posts to the feed.
            </p>
            <textarea
              value={pactDraft}
              onChange={(e) => setPactDraft(e.target.value.slice(0, 200))}
              rows={2}
              placeholder="e.g. I will not attack this general for the next week."
              className="w-full resize-none rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              maxLength={200}
            />
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-neutral-500">
                {200 - pactDraft.length} chars left · 1 pact / day · 7-day window
              </span>
              <button
                type="button"
                onClick={filePact}
                disabled={filingPact || pactDraft.trim().length === 0}
                className="rounded bg-emerald-500 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
              >
                {filingPact ? "Filing…" : "File pact"}
              </button>
            </div>
          </section>
        )}

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Tiles held" value={player.stats?.tilesHeld ?? 0} />
          <Stat label="Units alive" value={player.stats?.unitsAlive ?? 0} />
          <Stat label="Attacks won" value={player.stats?.attacksWon ?? 0} />
          <Stat label="Attacks lost" value={player.stats?.attacksLost ?? 0} />
          <Stat label="Tiles explored" value={player.tilesExplored} />
          <Stat label="Heroes" value={player.heroCount} />
          <Stat label="Seals broken" value={player.armageddonSealsBroken} />
          <Stat label="Phase" value={player.phase} />
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="text-lg font-semibold capitalize">{value}</div>
    </div>
  );
}
