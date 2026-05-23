/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// Public 3D flyover view of the Generals world. Lives under /game/ but
// intentionally bypasses the sign-in gate that /game/page.tsx applies —
// anonymous visitors are the primary audience (this page doubles as the
// game's marketing surface).
//
// Data comes from `game_world_snapshots/daily-3d`, written once per day
// by the `only=game-world-3d` cron. We read it server-side so the
// initial HTML ships with the world data baked in; the client never
// hits Firestore.

import type { Metadata } from "next";
import { readWorld3DSnapshotServer } from "@/lib/game/world-snapshot-3d";
import { World3DClient } from "./_components/World3DClient";

export const metadata: Metadata = {
  title: "Fly the Realm — Generals",
  description:
    "A live 3D fly-over of the Generals world. Orbit, zoom, and explore the kingdoms that contributors are building one PR at a time.",
  openGraph: {
    title: "Fly the Realm — Generals",
    description:
      "A live 3D fly-over of the Generals world. Built by the cursor-boston community.",
    type: "website",
  },
};

// 24h ISR — matches the daily-snapshot writer's cadence. The page
// itself is mostly static; the only server work is the one Firestore
// read inside readWorld3DSnapshotServer, which Next caches for 24h.
export const revalidate = 86400;

export default async function GameWorldPage() {
  const snapshot = await readWorld3DSnapshotServer();

  return (
    <World3DClient
      initialTiles={snapshot?.tiles ?? []}
      generatedAt={snapshot?.generatedAt ?? null}
    />
  );
}
