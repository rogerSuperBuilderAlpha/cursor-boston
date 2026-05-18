/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { useAuth } from "@/contexts/AuthContext";
import type {
  HeroEventKind,
  SafeHeroSummary,
} from "@/lib/game/types";
import { ReactionsRow } from "@/app/game/_components/dashboard/ReactionsRow";
import { HeroLoreSection } from "./HeroLoreSection";

// A subset of the SafeHeroEvent surfaced by the server. We don't need
// every optional field to render — the renderer below only reads the
// fields it knows how to display.
interface UiHeroEvent {
  id: string;
  kind: HeroEventKind;
  createdAt: string;
  tileId: string;
  ownerIdAtTime: string | null;
  seasonNumber: number;
  attackerId?: string;
  defenderId?: string;
  outcome?: "captured" | "repelled" | "stalemate";
  fromOwnerId?: string;
  toOwnerId?: string;
  fromTileId?: string;
  spellId?: string;
  targetTileId?: string;
  unitType?: "ground" | "siege" | "air";
  unitsBuilt?: number;
  specialUnitDefId?: string;
  reactions?: import("@/lib/game/types").ReactionMap;
}

interface HeroDetailResponse {
  success: boolean;
  hero?: SafeHeroSummary;
  events?: UiHeroEvent[];
  nextCursor?: string | null;
  hasMore?: boolean;
  error?: { message?: string } | string;
}

interface HeroEventsResponse {
  success: boolean;
  events?: UiHeroEvent[];
  nextCursor?: string | null;
  hasMore?: boolean;
  error?: { message?: string } | string;
}

interface HeroBackstoryResponse {
  success: boolean;
  heroId?: string;
  markdown?: string | null;
  error?: { message?: string } | string;
}

const GH_REPO = "rogerSuperBuilderAlpha/cursor-boston";
const BACKSTORY_DIR = "lib/game/content/hero-backstories";

export default function HeroDetailPage({
  params,
}: {
  params: Promise<{ heroId: string }>;
}) {
  const { heroId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const [hero, setHero] = useState<SafeHeroSummary | null>(null);
  const [events, setEvents] = useState<UiHeroEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [backstory, setBackstory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const token = await user.getIdToken();
      const [detailRes, backstoryRes] = await Promise.all([
        fetch(`/api/game/heroes/${encodeURIComponent(heroId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/game/heroes/${encodeURIComponent(heroId)}/backstory`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (detailRes.status === 404) {
        setNotFound(true);
        return;
      }
      const data = (await detailRes.json()) as HeroDetailResponse;
      if (!data.success || !data.hero) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Failed to load hero";
        throw new Error(msg);
      }
      setHero(data.hero);
      setEvents(data.events ?? []);
      setNextCursor(data.nextCursor ?? null);
      setHasMore(Boolean(data.hasMore));

      // Backstory is best-effort — never block the detail render on it.
      try {
        const bData = (await backstoryRes.json()) as HeroBackstoryResponse;
        if (bData.success) setBackstory(bData.markdown ?? null);
      } catch {
        // Ignore — null backstory is a fine default.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [user, heroId]);

  const loadMoreEvents = useCallback(async () => {
    if (!user || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/game/heroes/${encodeURIComponent(heroId)}/events?cursor=${encodeURIComponent(nextCursor)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = (await res.json()) as HeroEventsResponse;
      if (data.success) {
        setEvents((prev) => [...prev, ...(data.events ?? [])]);
        setNextCursor(data.nextCursor ?? null);
        setHasMore(Boolean(data.hasMore));
      }
    } finally {
      setLoadingMore(false);
    }
  }, [user, heroId, nextCursor, loadingMore]);

  useEffect(() => {
    if (authLoading || !user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    loadDetail();
  }, [authLoading, user, loadDetail]);

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

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <p className="mb-4 text-lg font-semibold">Hero not found.</p>
        <Link
          href="/game/heroes"
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm"
        >
          ← Back to roster
        </Link>
      </div>
    );
  }

  if (!hero) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">
          {error ?? "Failed to load"}
        </p>
        <Link
          href="/game/heroes"
          className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm"
        >
          ← Back to roster
        </Link>
      </div>
    );
  }

  const isMine = hero.currentOwnerId === user.uid;
  const isFallen = hero.isDeceased || hero.awaitingResurrection;
  const glyph =
    hero.class === "military" ? "⚔" : hero.class === "farm" ? "⚘" : "✦";
  const color =
    hero.class === "military"
      ? "text-red-600 dark:text-red-400"
      : hero.class === "farm"
        ? "text-amber-600 dark:text-amber-400"
        : "text-violet-600 dark:text-violet-400";

  const backstoryFileExists = backstory != null;
  const backstoryEditUrl = backstoryFileExists
    ? `https://github.com/${GH_REPO}/edit/develop/${BACKSTORY_DIR}/${hero.id}.md`
    : buildNewChapterUrl(hero);

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <Link
            href="/game/heroes"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← All heroes
          </Link>
          <Link
            href="/game"
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            Dashboard
          </Link>
        </div>

        <section className="mb-8 rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
          <div className="flex items-start gap-4">
            <span className={`text-5xl ${color}`}>{glyph}</span>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold">{hero.name}</h1>
              <p className="text-sm text-neutral-500 capitalize mt-1">
                {hero.specialty.replace(/-/g, " ")} {hero.class} ·{" "}
                {hero.caste} caste · Season {hero.emergedSeasonNumber}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {isMine && !isFallen && (
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                    yours
                  </span>
                )}
                {hero.isDeceased && (
                  <span className="text-xs px-2 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-400">
                    slain
                  </span>
                )}
                {hero.awaitingResurrection && (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                    awaiting resurrection
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                Location
              </div>
              {renderLocation(hero)}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                Stamina
              </div>
              {renderStamina(hero)}
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-semibold">Chronicle</h2>
            {isMine && !isFallen && (
              <a
                href={backstoryEditUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs px-3 py-1 rounded bg-amber-500 text-white hover:bg-amber-400"
              >
                {backstoryFileExists ? "Add a chapter →" : "Write the first chapter →"}
              </a>
            )}
          </div>
          {backstoryFileExists ? (
            <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-900/5 p-5 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
              >
                {backstory!}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {isMine && !isFallen
                  ? `As ${hero.name}'s current general, you can write the first chapter.`
                  : `${hero.name}'s chronicle is yet to be written.`}
              </p>
            </div>
          )}
        </section>

        <HeroLoreSection
          user={user}
          heroId={heroId}
          isFallen={isFallen}
          isAdmin={false}
        />


        <section>
          <h2 className="text-lg font-semibold mb-3">History</h2>
          {events.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No events visible to you yet.
            </p>
          ) : (
            <ol className="space-y-2">
              {events.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start gap-3 text-sm border-l-2 border-neutral-200 dark:border-neutral-800 pl-3 py-1"
                >
                  <span className="text-base">{kindGlyph(e.kind)}</span>
                  <div className="flex-1">
                    <p className="text-sm">{renderEventNarrative(e, hero.name)}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {formatTimestamp(e.createdAt)} · Season {e.seasonNumber}
                    </p>
                    <ReactionsRow
                      user={user}
                      scope="hero_event"
                      docId={e.id}
                      heroId={heroId}
                      initialReactions={e.reactions}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={loadMoreEvents}
                disabled={loadingMore}
                className="px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load earlier events"}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function renderLocation(hero: SafeHeroSummary) {
  if (hero.isDeceased && hero.deceasedTileId) {
    return (
      <span className="font-mono text-sm">
        ✟ fell at {hero.deceasedTileId}
      </span>
    );
  }
  if (hero.awaitingResurrection) {
    return <span className="text-neutral-500">⌛ between worlds</span>;
  }
  if (hero.currentTileId) {
    return (
      <Link
        href={`/game/tiles/${encodeURIComponent(hero.currentTileId)}`}
        className="font-mono text-emerald-600 dark:text-emerald-400 hover:underline"
      >
        📍 {hero.currentTileId} →
      </Link>
    );
  }
  return (
    <span className="text-neutral-500">
      📍 Whereabouts unknown — your kingdom does not border this hero&apos;s tile.
    </span>
  );
}

function renderStamina(hero: SafeHeroSummary) {
  if (hero.stamina == null || hero.staminaMax == null) {
    return <span className="text-neutral-500">—</span>;
  }
  const pct = Math.max(
    0,
    Math.min(100, Math.round((hero.stamina / hero.staminaMax) * 100))
  );
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${pct < 30 ? "bg-red-500" : pct < 60 ? "bg-amber-500" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono w-14 text-right text-neutral-500">
        {hero.stamina}/{hero.staminaMax}
      </span>
    </div>
  );
}

function kindGlyph(kind: HeroEventKind): string {
  switch (kind) {
    case "emerged":
      return "✨";
    case "engaged_attacker":
      return "⚔";
    case "engaged_defender":
      return "🛡";
    case "slain":
      return "✟";
    case "defected":
      return "🪄";
    case "moved_on_capture":
      return "➜";
    case "spell_cast":
      return "✦";
    case "recruited":
      return "⚘";
    case "special_unit_summoned":
      return "★";
    case "season_ended":
      return "🌒";
    default:
      return "·";
  }
}

function renderEventNarrative(e: UiHeroEvent, heroName: string): string {
  switch (e.kind) {
    case "emerged":
      return `${heroName} emerged on tile ${e.tileId}.`;
    case "engaged_attacker":
      return `${heroName} attacked tile ${e.targetTileId ?? "?"} from ${e.tileId} — ${e.outcome ?? "engaged"}.`;
    case "engaged_defender":
      return `${heroName}'s tile ${e.tileId} was attacked — ${e.outcome ?? "engaged"}.`;
    case "slain":
      return `${heroName} fell in battle on tile ${e.tileId}.`;
    case "defected":
      return `${heroName} swore allegiance to a new general on tile ${e.tileId}.`;
    case "moved_on_capture":
      return `${heroName} followed the conquest from ${e.fromTileId ?? "?"} to ${e.tileId}.`;
    case "spell_cast":
      return `${heroName} channeled ${e.spellId ?? "a spell"} from ${e.tileId} → ${e.targetTileId ?? "?"}.`;
    case "recruited":
      return `${heroName} mustered ${e.unitsBuilt ?? "?"} ${e.unitType ?? ""} units on tile ${e.tileId}.`;
    case "special_unit_summoned":
      return `${heroName} called forth a hero unit: ${e.specialUnitDefId ?? "?"}.`;
    case "season_ended":
      return `Season ${e.seasonNumber} ended — ${heroName} entered the long sleep.`;
    default:
      return `${heroName} — ${e.kind}.`;
  }
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/** GitHub web-UI URL for creating a new backstory file with a prefilled
 *  template. Falls back to the file's edit URL when one already exists. */
function buildNewChapterUrl(hero: SafeHeroSummary): string {
  const template = `---
heroId: ${hero.id}
heroName: ${hero.name}
class: ${hero.class}
caste: ${hero.caste}
appendOnly: true
---

## Chapter 1 — Title here

_Contributor: @your-handle · ${new Date().toISOString().slice(0, 10)}_

Tell the story of ${hero.name}'s first deeds. Future chapters will be
appended below this one — never edited, only added to.
`;
  return `https://github.com/${GH_REPO}/new/develop/${BACKSTORY_DIR}?filename=${encodeURIComponent(`${hero.id}.md`)}&value=${encodeURIComponent(template)}`;
}
