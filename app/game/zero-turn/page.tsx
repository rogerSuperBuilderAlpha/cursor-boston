/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import type { GamePlayer, GameTile } from "@/lib/game/types";

interface PlayerResponse {
  success: boolean;
  player?: GamePlayer | null;
  error?: { message?: string } | string;
}

interface TilesResponse {
  success: boolean;
  tiles?: GameTile[];
  error?: { message?: string } | string;
}

type ActionState = { kind: "idle" } | { kind: "pending" } | { kind: "ok"; msg: string } | { kind: "err"; msg: string };

function ActionRow(props: {
  title: string;
  description: string;
  status?: string;
  state: ActionState;
  controls: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 mb-3 bg-white dark:bg-neutral-950">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h3 className="font-semibold">{props.title}</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            {props.description}
          </p>
          {props.status && (
            <p className="text-xs text-neutral-500 mt-1">{props.status}</p>
          )}
        </div>
        <div className="flex-shrink-0">{props.controls}</div>
      </div>
      {props.state.kind === "ok" && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-2">
          ✓ {props.state.msg}
        </p>
      )}
      {props.state.kind === "err" && (
        <p className="text-xs text-red-700 dark:text-red-400 mt-2">
          ✗ {props.state.msg}
        </p>
      )}
    </div>
  );
}

export default function ZeroTurnHubPage() {
  const { user, loading: authLoading } = useAuth();
  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [tiles, setTiles] = useState<GameTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [pepTalkTileId, setPepTalkTileId] = useState("");
  const [pepTalkState, setPepTalkState] = useState<ActionState>({ kind: "idle" });
  const [meditateTileId, setMeditateTileId] = useState("");
  const [meditateState, setMeditateState] = useState<ActionState>({ kind: "idle" });
  const [stanceTileId, setStanceTileId] = useState("");
  const [stanceState, setStanceState] = useState<ActionState>({ kind: "idle" });
  const [lastStandTileId, setLastStandTileId] = useState("");
  const [lastStandState, setLastStandState] = useState<ActionState>({ kind: "idle" });
  const [redistSource, setRedistSource] = useState("");
  const [redistDest, setRedistDest] = useState("");
  const [redistGround, setRedistGround] = useState(0);
  const [redistSiege, setRedistSiege] = useState(0);
  const [redistAir, setRedistAir] = useState(0);
  const [redistState, setRedistState] = useState<ActionState>({ kind: "idle" });

  const refresh = useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const [pRes, tRes] = await Promise.all([
      fetch("/api/game/player", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/game/tile/owned", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
    ]);
    if (pRes.ok) {
      const data: PlayerResponse = await pRes.json();
      setPlayer(data.player ?? null);
    }
    if (tRes && tRes.ok) {
      const data: TilesResponse = await tRes.json();
      setTiles(data.tiles ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      refresh();
    }
  }, [authLoading, user, refresh]);

  const callApi = useCallback(
    async (
      url: string,
      body: unknown,
      setState: (s: ActionState) => void,
      successMsg: string,
      method: string = "POST"
    ) => {
      if (!user) return;
      setState({ kind: "pending" });
      try {
        const token = await user.getIdToken();
        const res = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: method === "POST" ? JSON.stringify(body) : undefined,
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : data.error?.message ?? `HTTP ${res.status}`;
          setState({ kind: "err", msg });
          return;
        }
        setState({ kind: "ok", msg: successMsg });
        await refresh();
      } catch (e) {
        setState({ kind: "err", msg: e instanceof Error ? e.message : "Failed" });
      }
    },
    [user, refresh]
  );

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-neutral-500">Loading…</p>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p>Please sign in.</p>
      </div>
    );
  }
  if (!player) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p>No player record.</p>
      </div>
    );
  }

  const atZeroTurns = player.turnsRemaining === 0;
  const tilesWithHero = tiles.filter((t) => t.hero != null);
  const tilesInStance = tiles.filter(
    (t) => t.defensiveStance && t.defensiveStance.active
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/game" className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline">
          ← Back to dashboard
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-2">Between turns</h1>
      <p className="text-neutral-600 dark:text-neutral-400 mb-6">
        Gameplay-operative actions you can take without spending turns. Some
        are 0-turn-only (consolation mechanics); others are available any
        time as part of your normal toolkit.
      </p>

      <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 mb-6">
        <p className="text-sm">
          <strong>Status:</strong> {player.turnsRemaining} turns remaining ·{" "}
          {tilesWithHero.length} heroes · {tilesInStance.length} tiles in
          defensive stance
          {player.oathbreakerUntil && (
            <span className="block mt-1 text-red-700 dark:text-red-400">
              ⚠ Oathbreaker mark active — your attacks deal reduced damage
              while this mark stands.
            </span>
          )}
          {player.pendingProphecyBonus && player.pendingProphecyBonus > 0 ? (
            <span className="block mt-1 text-emerald-700 dark:text-emerald-400">
              +{player.pendingProphecyBonus} prophecy bonus turns waiting for
              next weekly grant.
            </span>
          ) : null}
        </p>
      </div>

      <h2 className="text-lg font-semibold mb-3 mt-6">Hero management</h2>

      <ActionRow
        title="Pep talk"
        description="Grant +15 stamina to a hero. 0-turn-only; 3/day."
        status={atZeroTurns ? "Available" : "Requires 0 turns remaining"}
        state={pepTalkState}
        controls={
          <div className="flex gap-2">
            <input
              type="text"
              value={pepTalkTileId}
              onChange={(e) => setPepTalkTileId(e.target.value)}
              placeholder="tileId"
              className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-900"
            />
            <button
              onClick={() =>
                callApi(
                  "/api/game/heroes/pep-talk",
                  { tileId: pepTalkTileId },
                  setPepTalkState,
                  "Pep talk delivered"
                )
              }
              disabled={!pepTalkTileId || !atZeroTurns || pepTalkState.kind === "pending"}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-800 text-white rounded text-sm"
            >
              Pep talk
            </button>
          </div>
        }
      />

      <ActionRow
        title="Meditation"
        description="Pull a hero off duty for 24h. Stamina set to max; hero can't fight while meditating. Cap: 1 at a time."
        state={meditateState}
        controls={
          <div className="flex gap-2">
            <input
              type="text"
              value={meditateTileId}
              onChange={(e) => setMeditateTileId(e.target.value)}
              placeholder="tileId"
              className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-900"
            />
            <button
              onClick={() =>
                callApi(
                  "/api/game/heroes/meditate",
                  { tileId: meditateTileId },
                  setMeditateState,
                  "Hero now meditating"
                )
              }
              disabled={!meditateTileId || meditateState.kind === "pending"}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-800 text-white rounded text-sm"
            >
              Meditate
            </button>
          </div>
        }
      />

      <h2 className="text-lg font-semibold mb-3 mt-6">Active defense</h2>

      <ActionRow
        title="Defensive stance"
        description="+25% defense on a tile; tile can't attack out. Free toggle; 6h lock prevents flicker. Cap scales with empire size."
        status={`${tilesInStance.length} active · cap = ${Math.max(1, Math.floor((player.stats?.tilesHeld ?? 0) / 100))}`}
        state={stanceState}
        controls={
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={stanceTileId}
              onChange={(e) => setStanceTileId(e.target.value)}
              placeholder="tileId"
              className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-900"
            />
            <button
              onClick={() =>
                callApi(
                  "/api/game/tiles/stance",
                  { tileId: stanceTileId, active: true },
                  setStanceState,
                  "Stance toggled on"
                )
              }
              disabled={!stanceTileId || stanceState.kind === "pending"}
              className="px-3 py-1 bg-sky-600 hover:bg-sky-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-800 text-white rounded text-sm"
            >
              On
            </button>
            <button
              onClick={() =>
                callApi(
                  "/api/game/tiles/stance",
                  { tileId: stanceTileId, active: false },
                  setStanceState,
                  "Stance toggled off"
                )
              }
              disabled={!stanceTileId || stanceState.kind === "pending"}
              className="px-3 py-1 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 disabled:bg-neutral-100 dark:disabled:bg-neutral-900 rounded text-sm"
            >
              Off
            </button>
          </div>
        }
      />

      <ActionRow
        title="Last Stand"
        description="+50% defense on a threatened tile (single use). Adjacent tiles take -25% (rally pulls reserves). 0-turn-only; 24h cooldown; requires recent inbound attack signal."
        status={
          player.lastStandUsedAt
            ? `Last used: ${new Date(
                player.lastStandUsedAt instanceof Date
                  ? player.lastStandUsedAt
                  : (player.lastStandUsedAt as { seconds: number }).seconds * 1000
              ).toLocaleString()}`
            : "Available"
        }
        state={lastStandState}
        controls={
          <div className="flex gap-2">
            <input
              type="text"
              value={lastStandTileId}
              onChange={(e) => setLastStandTileId(e.target.value)}
              placeholder="tileId"
              className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-900"
            />
            <button
              onClick={() =>
                callApi(
                  "/api/game/last-stand",
                  { tileId: lastStandTileId },
                  setLastStandState,
                  "Last Stand declared"
                )
              }
              disabled={!lastStandTileId || !atZeroTurns || lastStandState.kind === "pending"}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-800 text-white rounded text-sm"
            >
              Declare
            </button>
          </div>
        }
      />

      <ActionRow
        title="Redistribute units"
        description="Move units between two adjacent owned tiles. 8% transit loss applies. 3/day."
        state={redistState}
        controls={
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={redistSource}
              onChange={(e) => setRedistSource(e.target.value)}
              placeholder="from tileId"
              className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-900"
            />
            <input
              type="text"
              value={redistDest}
              onChange={(e) => setRedistDest(e.target.value)}
              placeholder="to tileId"
              className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-900"
            />
            <input
              type="number"
              value={redistGround}
              onChange={(e) => setRedistGround(Math.max(0, parseInt(e.target.value || "0", 10)))}
              placeholder="ground"
              className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-900"
            />
            <input
              type="number"
              value={redistSiege}
              onChange={(e) => setRedistSiege(Math.max(0, parseInt(e.target.value || "0", 10)))}
              placeholder="siege"
              className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-900"
            />
            <input
              type="number"
              value={redistAir}
              onChange={(e) => setRedistAir(Math.max(0, parseInt(e.target.value || "0", 10)))}
              placeholder="air"
              className="px-2 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-sm bg-white dark:bg-neutral-900"
            />
            <button
              onClick={() =>
                callApi(
                  "/api/game/redistribute",
                  {
                    sourceTileId: redistSource,
                    destTileId: redistDest,
                    units: { ground: redistGround, siege: redistSiege, air: redistAir },
                  },
                  setRedistState,
                  "Redistribution complete (8% transit loss applied)"
                )
              }
              disabled={
                !redistSource ||
                !redistDest ||
                redistGround + redistSiege + redistAir < 1 ||
                redistState.kind === "pending"
              }
              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-800 text-white rounded text-sm col-span-2"
            >
              Move
            </button>
          </div>
        }
      />

      <h2 className="text-lg font-semibold mb-3 mt-6">Planning</h2>

      <ActionRow
        title="Queue orders"
        description="Plan attacks, recruits, or spells to execute at next weekly grant. Each order costs its normal turns when it fires; insufficient-turns skip with a reason."
        state={{ kind: "idle" }}
        controls={
          <Link
            href="/game/orders"
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm"
          >
            Manage queue
          </Link>
        }
      />

      <ActionRow
        title="Battle autopsy"
        description="Browse past attacks. Click into one for a what-if analysis showing which composition changes would have flipped the outcome."
        state={{ kind: "idle" }}
        controls={
          <Link
            href="/game/attacks"
            className="px-3 py-1 bg-neutral-600 hover:bg-neutral-700 text-white rounded text-sm"
          >
            Attack log
          </Link>
        }
      />

      <div className="mt-8 text-xs text-neutral-500">
        Tile ids are e.g. <code className="font-mono">q0r0</code>. Find them
        on the <Link className="underline" href="/game/tiles">tile map</Link>.
      </div>
    </div>
  );
}
