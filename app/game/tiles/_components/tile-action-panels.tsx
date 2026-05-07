/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";
import { ALL_SPELLS } from "@/lib/game/content";
import type {
  GamePlayer,
  LandType,
  MapTile,
  SpellDefinition,
  UnitStack,
  UnitType,
} from "@/lib/game/types";
import { neighborTileIds } from "@/lib/game/world-gen";

export const UNIT_TYPES: UnitType[] = ["ground", "siege", "air"];

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
        {label}
      </div>
      <div className="text-base font-semibold capitalize break-words">
        {value}
      </div>
    </div>
  );
}

export function OwnTilePanel({
  tile,
  player,
  myDefenseSpells,
  busy,
  onBuild,
  onArmSpell,
  onAssign,
}: {
  tile: MapTile;
  player: GamePlayer;
  myDefenseSpells: SpellDefinition[];
  busy: boolean;
  onBuild: (unitType: UnitType) => void;
  onArmSpell: (spellId: string) => void;
  onAssign: (newType: LandType) => void;
}) {
  const canBuild =
    player.phase === "play" &&
    tile.type === "military" &&
    player.turnsRemaining >= 5;

  const canAssign =
    (player.phase === "distribute" || player.phase === "play") &&
    tile.type !== "unrevealed" &&
    player.turnsRemaining >= 1;

  const assignableTypes: { type: LandType; label: string; hint: string }[] = [
    {
      type: "military",
      label: "Military",
      hint: "Builds units; raises tile capacity by +200 in combat.",
    },
    {
      type: "food",
      label: "Food",
      hint: "Raises your global unit cap (+5 each up to 50, +2.5 above).",
    },
    {
      type: "magic",
      label: "Magic",
      hint: "Multiplies spell strength.",
    },
    {
      type: "unassigned",
      label: "Unassigned",
      hint: "Revert this tile so you can re-assign later (still costs 1 turn).",
    },
  ];

  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">
          Assign land type <span className="text-neutral-400 normal-case font-normal">— 1 turn</span>
        </h2>
        {tile.type === "unrevealed" ? (
          <p className="text-sm text-neutral-500">Reveal this tile first.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {assignableTypes.map((a) => {
              const isCurrent = tile.type === a.type;
              return (
                <button
                  key={a.type}
                  onClick={() => onAssign(a.type)}
                  disabled={busy || !canAssign || isCurrent}
                  title={a.hint}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors disabled:opacity-50 ${
                    isCurrent
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 cursor-default"
                      : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  <div className="font-medium">{a.label}</div>
                  {isCurrent && (
                    <div className="text-xs text-neutral-500 mt-0.5 leading-tight">
                      current
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">
          Build units <span className="text-neutral-400 normal-case font-normal">— +10 / 5 turns. Air ▶ Ground ▶ Siege ▶ Air</span>
        </h2>
        {tile.type !== "military" ? (
          <p className="text-sm text-neutral-500">
            Only military tiles. This tile is{" "}
            <strong className="capitalize">{tile.type}</strong>.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {UNIT_TYPES.map((u) => (
              <button
                key={u}
                onClick={() => onBuild(u)}
                disabled={busy || !canBuild}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors capitalize disabled:opacity-50"
              >
                +10 {u}
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">
          Arm defense spell <span className="text-neutral-400 normal-case font-normal">— 5 turns. Triggers when attacked.</span>
        </h2>
        {tile.type === "unrevealed" ? (
          <p className="text-sm text-neutral-500">Reveal this tile first.</p>
        ) : myDefenseSpells.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Choose a caste to unlock defense spells.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {myDefenseSpells.map((s) => (
              <button
                key={s.id}
                onClick={() => onArmSpell(s.id)}
                disabled={
                  busy ||
                  player.phase !== "play" ||
                  player.turnsRemaining < 5 ||
                  tile.armedDefenseSpellId === s.id
                }
                className="px-3 py-1.5 text-sm border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                title={s.description}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function EnemyTilePanel({
  tile,
  player,
  ownedTiles,
  busy,
  onAttack,
}: {
  tile: MapTile;
  player: GamePlayer;
  ownedTiles: MapTile[];
  busy: boolean;
  onAttack: (
    sourceTileId: string,
    units: UnitStack,
    offenseSpellId: string | null
  ) => void;
}) {
  const targetBorders = new Set(neighborTileIds(tile.q, tile.r));
  const myBorders = ownedTiles.filter((t) => targetBorders.has(t.tileId));
  const myCaste = player.caste;
  const offenseSpells = myCaste
    ? ALL_SPELLS.filter((s) => s.caste === myCaste && s.type === "offense")
    : [];

  const [sourceTileId, setSourceTileId] = useState(myBorders[0]?.tileId ?? "");
  const [ground, setGround] = useState(0);
  const [siege, setSiege] = useState(0);
  const [air, setAir] = useState(0);
  const [offenseSpellId, setOffenseSpellId] = useState<string>("");

  const source = myBorders.find((t) => t.tileId === sourceTileId) ?? null;
  const sentTotal = ground + siege + air;
  const sourceTotal = source
    ? source.units.ground + source.units.siege + source.units.air
    : 0;

  const canAttack =
    !!source &&
    sentTotal > 0 &&
    sentTotal <= sourceTotal &&
    ground <= (source?.units.ground ?? 0) &&
    siege <= (source?.units.siege ?? 0) &&
    air <= (source?.units.air ?? 0) &&
    player.phase === "play" &&
    player.turnsRemaining >= 1 + (offenseSpellId ? 5 : 0);

  if (myBorders.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6 text-center text-sm text-neutral-500">
        None of your tiles border this enemy tile, so you can&apos;t attack it.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Launch attack{" "}
        <span className="text-neutral-400 normal-case font-normal">
          — Air ▶ Ground ▶ Siege ▶ Air. 1 turn (+5 with spell).
        </span>
      </h2>

      <label className="block text-sm font-medium">
        Source tile
        <select
          value={sourceTileId}
          onChange={(e) => setSourceTileId(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
        >
          {myBorders.map((t) => (
            <option key={t.tileId} value={t.tileId}>
              {t.tileId} — G{t.units.ground} S{t.units.siege} A{t.units.air}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-3 gap-3">
        <UnitInput
          label={`Ground / ${source?.units.ground ?? 0}`}
          value={ground}
          max={source?.units.ground ?? 0}
          onChange={setGround}
        />
        <UnitInput
          label={`Siege / ${source?.units.siege ?? 0}`}
          value={siege}
          max={source?.units.siege ?? 0}
          onChange={setSiege}
        />
        <UnitInput
          label={`Air / ${source?.units.air ?? 0}`}
          value={air}
          max={source?.units.air ?? 0}
          onChange={setAir}
        />
      </div>

      <label className="block text-sm font-medium">
        Offense spell (optional, +5 turns)
        <select
          value={offenseSpellId}
          onChange={(e) => setOffenseSpellId(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
        >
          <option value="">— none —</option>
          {offenseSpells.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <button
        onClick={() =>
          onAttack(
            sourceTileId,
            { ground, siege, air },
            offenseSpellId || null
          )
        }
        disabled={busy || !canAttack}
        className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50"
      >
        {busy ? "Resolving…" : `Send ${sentTotal} units (cost ${1 + (offenseSpellId ? 5 : 0)} turns)`}
      </button>
    </div>
  );
}

function UnitInput({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-neutral-500">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          onChange(Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0);
        }}
        className="mt-1 block w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
      />
    </label>
  );
}
