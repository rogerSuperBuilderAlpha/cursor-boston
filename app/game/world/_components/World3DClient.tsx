/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { World3DTile } from "@/lib/game/world-snapshot-3d";
import { CASTE_LABEL, CASTE_COLOR_HEX } from "./world-constants";
import { TileInfoCard } from "./TileInfoCard";
import { HowToPlayDrawer } from "./HowToPlayDrawer";

// `three` and `@react-three/fiber` touch `window` on import; load the
// scene only on the client.
const World3DScene = dynamic(
  () =>
    import("./World3DScene").then((m) => ({ default: m.World3DScene })),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-neutral-950 text-neutral-400">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-500 mx-auto mb-3" />
          <p className="text-sm">Loading world…</p>
        </div>
      </div>
    ),
  }
);

interface World3DClientProps {
  initialTiles: World3DTile[];
  generatedAt: string | null;
}

export function World3DClient({
  initialTiles,
  generatedAt,
}: World3DClientProps) {
  const { user, loading: authLoading } = useAuth();
  const [selected, setSelected] = useState<World3DTile | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Player probe is keyed by uid so a sign-out (user → null) or a
  // sign-in-as-different-account naturally invalidates the stored
  // hasPlayer without an in-effect setState reset.
  const [playerProbe, setPlayerProbe] = useState<{
    uid: string;
    hasPlayer: boolean;
  } | null>(null);
  const hasPlayer: boolean | null =
    user && playerProbe?.uid === user.uid ? playerProbe.hasPlayer : null;

  const tileIndex = useMemo(() => {
    const m = new Map<string, World3DTile>();
    for (const t of initialTiles) m.set(t.tileId, t);
    return m;
  }, [initialTiles]);

  // Lazy probe for kingdom existence. Only fires once auth has settled
  // AND we have a user — anonymous visitors never hit /api/game/player
  // (it 401s without a token), keeping the public flyover truly public.
  // No setState on the failure / signed-out paths: hasPlayer is derived
  // from playerProbe.uid above, so a stale probe is invalidated
  // automatically when the user changes.
  useEffect(() => {
    if (authLoading || !user) return;
    const uid = user.uid;
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/game/player", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { player?: unknown | null };
        if (cancelled) return;
        setPlayerProbe({ uid, hasPlayer: Boolean(data.player) });
      } catch {
        // Network/parse failure — leave hasPlayer as null so the CTA
        // shows the neutral "Access game" copy until the user retries.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // CTA copy ladder, from most-engaged to least:
  //   has kingdom     → "Manage kingdom"   (existing player, returning)
  //   signed-in, no   → "Create my kingdom" (recruit them into the game)
  //   signed-out      → "Sign in to play"   (the funnel entry)
  // The destination is /game in every case except signed-out (→ /login).
  // /game itself routes them to the right gate, so we don't need to
  // branch on hasPlayer here.
  const ctaHref = user ? "/game" : "/login";
  let ctaLabel: string;
  if (!user) {
    ctaLabel = "Sign in to play";
  } else if (hasPlayer === true) {
    ctaLabel = "Manage kingdom";
  } else if (hasPlayer === false) {
    ctaLabel = "Create my kingdom";
  } else {
    // Still loading kingdom state — show a neutral label rather than
    // flicker between Manage/Create.
    ctaLabel = "Access game";
  }
  const ctaShowSpinner = authLoading;

  const generatedLabel = generatedAt
    ? new Date(generatedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;

  const isEmpty = initialTiles.length === 0;

  // fixed + inset-0 + z-50 deliberately escapes the AppShell wrapper.
  // Without this, the AppShell footer extends the document below the
  // viewport, so any drag on the canvas gets interpreted as a page
  // scroll instead of an orbit/pan gesture — making the world feel
  // "stuck, only zoom works".
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-neutral-950 text-neutral-100">
      <World3DScene
        tiles={initialTiles}
        onSelectTile={(tileId) => {
          const t = tileId ? tileIndex.get(tileId) ?? null : null;
          setSelected(t);
        }}
        selectedTileId={selected?.tileId ?? null}
      />

      {/* Top-left HUD */}
      <div className="pointer-events-none absolute top-0 left-0 p-5 sm:p-6 max-w-md">
        <div className="pointer-events-auto inline-block rounded-lg bg-neutral-900/70 backdrop-blur px-4 py-3 border border-neutral-700/50">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Generals
          </h1>
          <p className="text-xs sm:text-sm text-neutral-300 mt-1 max-w-sm">
            A turn-based realm where every PR you merge buys you 100 turns.
            Drag to fly across the map, scroll to zoom, right-drag to rotate.
          </p>
          {generatedLabel && (
            <p className="text-[10px] text-neutral-500 mt-2 uppercase tracking-wide">
              Snapshot: {generatedLabel}
            </p>
          )}
        </div>
      </div>

      {/* Bottom-left: How to play */}
      <div className="absolute bottom-0 left-0 p-5 sm:p-6">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded-lg bg-neutral-900/70 backdrop-blur hover:bg-neutral-800/80 border border-neutral-700/50 px-4 py-2 text-sm text-neutral-100 transition-colors"
        >
          How to read this map
        </button>
      </div>

      {/* Bottom-right: primary CTA */}
      <div className="absolute bottom-0 right-0 p-5 sm:p-6">
        <Link
          href={ctaHref}
          className="inline-block rounded-lg bg-emerald-500 hover:bg-emerald-400 px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-medium text-white shadow-lg shadow-emerald-500/20 transition-colors"
        >
          {ctaShowSpinner ? "…" : ctaLabel}
        </Link>
      </div>

      {/* Tile info card (slides in when a tile is clicked) */}
      {selected && (
        <TileInfoCard
          tile={selected}
          onClose={() => setSelected(null)}
          signedIn={!!user}
          casteColorHex={CASTE_COLOR_HEX}
          casteLabel={CASTE_LABEL}
        />
      )}

      {/* How-to-play slide-in drawer */}
      <HowToPlayDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Empty-state banner: rendered behind the scene since the scene
          will be empty too. Keeps the page graceful pre-first-cron. */}
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-lg bg-neutral-900/80 backdrop-blur border border-neutral-700/50 px-6 py-5 max-w-sm text-center">
            <p className="text-sm text-neutral-300">
              The world hasn&apos;t been snapshotted yet — check back tomorrow
              once the daily build runs.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
