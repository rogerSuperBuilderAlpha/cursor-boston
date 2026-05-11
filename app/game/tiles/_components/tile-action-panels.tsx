/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";
import {
  ALL_SPELLS,
  ARTIFACTS_BY_ID,
  getUnitForCasteAndType,
} from "@/lib/game/content";
import { realizedSpellMagnitude } from "@/lib/game/combat";
import { CatalogImage } from "@/app/game/_components/CatalogImage";
import type {
  GameArtifact,
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
  artifacts = [],
  busy,
  onBuild,
  onArmSpell,
  onAssign,
  onUseArtifact,
}: {
  tile: MapTile;
  player: GamePlayer;
  myDefenseSpells: SpellDefinition[];
  /** Unused artifacts only — pass [] to hide the artifacts section. */
  artifacts?: ReadonlyArray<GameArtifact>;
  busy: boolean;
  onBuild: (unitType: UnitType) => void;
  onArmSpell: (spellId: string) => void;
  onAssign: (newType: LandType) => void;
  /** Wires up to /api/game/artifact/use for defense artifacts. Optional —
   *  panel hides the artifact section when not provided. */
  onUseArtifact?: (artifactId: string) => void;
}) {
  const defensiveArtifacts = artifacts.filter((a) => a.type === "defense");
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
            {UNIT_TYPES.map((u) => {
              const unit = player.caste
                ? getUnitForCasteAndType(player.caste, u)
                : null;
              return (
                <button
                  key={u}
                  onClick={() => onBuild(u)}
                  disabled={busy || !canBuild}
                  className="flex items-center gap-2 px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                  title={unit?.description ?? u}
                >
                  {unit ? <CatalogImage entry={unit} size="xs" /> : null}
                  <span className="capitalize">
                    +10 {unit?.name ?? u}
                  </span>
                </button>
              );
            })}
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
                className="flex items-center gap-2 px-3 py-1.5 text-sm border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                title={s.description}
              >
                <CatalogImage entry={s} size="xs" />
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {onUseArtifact && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">
            Defense artifacts{" "}
            <span className="text-neutral-400 normal-case font-normal">
              — apply to this tile
            </span>
          </h2>
          {defensiveArtifacts.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No unused defense artifacts in inventory.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {defensiveArtifacts.map((a) => {
                const def = ARTIFACTS_BY_ID.get(a.definitionId);
                return (
                  <button
                    key={a.id}
                    onClick={() => onUseArtifact(a.id)}
                    disabled={busy || tile.type === "unrevealed"}
                    title={def?.description ?? a.definitionId}
                    className="flex items-start gap-2 p-2 text-left text-sm border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                  >
                    <CatalogImage entry={def ?? { name: a.definitionId }} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">
                        Use {def?.name ?? a.definitionId}
                      </div>
                      <div className="text-[11px] text-neutral-600 dark:text-neutral-400 line-clamp-2 mt-0.5">
                        {def?.description ?? ""}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export function EnemyTilePanel({
  tile,
  player,
  ownedTiles,
  artifacts = [],
  busy,
  onAttack,
  onSpy,
  onUseArtifact,
}: {
  tile: MapTile;
  player: GamePlayer;
  ownedTiles: MapTile[];
  /** Unused artifacts only — pass [] to hide artifact-use sections. */
  artifacts?: ReadonlyArray<GameArtifact>;
  busy: boolean;
  onAttack: (
    sourceTileId: string,
    units: UnitStack,
    offenseSpellId: string | null
  ) => void;
  // Optional: when present, renders a Spy section that casts the player's
  // caste intel spell on this tile. Wires straight to /api/game/spy.
  onSpy?: (spellId: string) => void;
  /** Wires up to /api/game/artifact/use for offense + intel artifacts.
   *  When present, panel renders sections for each artifact category. */
  onUseArtifact?: (artifactId: string) => void;
}) {
  const offensiveArtifacts = artifacts.filter((a) => a.type === "offense");
  const intelArtifacts = artifacts.filter((a) => a.type === "intel");
  const targetBorders = new Set(neighborTileIds(tile.q, tile.r));
  const myBorders = ownedTiles.filter((t) => targetBorders.has(t.tileId));
  const myCaste = player.caste;
  // Only show offense spells the player has actually unlocked (tilesHeld
  // gate). Picking an unusable spell would 400 from the server and isn't a
  // meaningful choice — better to hide them outright. Turn-budget is still
  // handled by the disabled-attack reasoning below.
  const offenseSpells = myCaste
    ? ALL_SPELLS.filter(
        (s) =>
          s.caste === myCaste &&
          s.type === "offense" &&
          player.stats.tilesHeld >= s.minTilesRequired
      )
    : [];
  // Magic-land count drives spell scaling. PlayerStats doesn't store it
  // directly, so we count it off the player's owned tiles. Cheap (the
  // attack panel already has ownedTiles in scope).
  const playerMagicLandCount = ownedTiles.filter((t) => t.type === "magic").length;
  const intelSpell = myCaste
    ? ALL_SPELLS.find((s) => s.caste === myCaste && s.type === "intel")
    : null;
  const intelTilesGateMet =
    intelSpell !== undefined && intelSpell !== null
      ? player.stats.tilesHeld >= intelSpell.minTilesRequired
      : false;
  const intelTurnsAffordable =
    intelSpell !== undefined && intelSpell !== null
      ? player.turnsRemaining >= intelSpell.turnCost
      : false;

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

  const offenseArtifactSection =
    onUseArtifact && offensiveArtifacts.length > 0 ? (
      <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 p-4 space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
          Offensive artifacts
        </h2>
        <p className="text-xs text-red-700/70 dark:text-red-300/70">
          One-time use. The bonus consumes on your next attack.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {offensiveArtifacts.map((a) => {
            const def = ARTIFACTS_BY_ID.get(a.definitionId);
            return (
              <button
                key={a.id}
                onClick={() => onUseArtifact(a.id)}
                disabled={busy}
                title={def?.description ?? a.definitionId}
                className="flex items-start gap-2 p-2 text-left text-sm border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
              >
                <CatalogImage entry={def ?? { name: a.definitionId }} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">
                    Use {def?.name ?? a.definitionId}
                  </div>
                  <div className="text-[11px] text-neutral-600 dark:text-neutral-400 line-clamp-2 mt-0.5">
                    {def?.description ?? ""}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  const intelArtifactSection =
    onUseArtifact && intelArtifacts.length > 0 ? (
      <div className="rounded-lg border border-violet-200 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/20 p-4 space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
          Intel artifacts
        </h2>
        <p className="text-xs text-violet-700/70 dark:text-violet-300/70">
          One-time use. Reveals intel on this tile when spent.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {intelArtifacts.map((a) => {
            const def = ARTIFACTS_BY_ID.get(a.definitionId);
            return (
              <button
                key={a.id}
                onClick={() => onUseArtifact(a.id)}
                disabled={busy}
                title={def?.description ?? a.definitionId}
                className="flex items-start gap-2 p-2 text-left text-sm border border-violet-300 dark:border-violet-700 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors disabled:opacity-50"
              >
                <CatalogImage entry={def ?? { name: a.definitionId }} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">
                    Use {def?.name ?? a.definitionId}
                  </div>
                  <div className="text-[11px] text-neutral-600 dark:text-neutral-400 line-clamp-2 mt-0.5">
                    {def?.description ?? ""}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  const spySection = onSpy && intelSpell ? (
    <div className="rounded-lg border border-violet-200 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/20 p-4 space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
        Spy: {intelSpell.name}{" "}
        <span className="text-neutral-400 normal-case font-normal">
          — {intelSpell.turnCost} turns
        </span>
      </h2>
      <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
        {intelSpell.description}
      </p>
      <button
        onClick={() => onSpy(intelSpell.id)}
        disabled={busy || !intelTilesGateMet || !intelTurnsAffordable}
        className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors disabled:opacity-50 text-sm font-medium"
      >
        {busy ? "Casting…" : "Cast spy"}
      </button>
      {!intelTilesGateMet && (
        <p className="text-xs text-neutral-500">
          Needs {intelSpell.minTilesRequired} tiles held (you have{" "}
          {player.stats.tilesHeld}).
        </p>
      )}
    </div>
  ) : null;

  if (myBorders.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6 text-center text-sm text-neutral-500">
          None of your tiles border this enemy tile, so you can&apos;t attack
          it.
          {onSpy && intelSpell ? " You can still spy on it from anywhere." : ""}
        </div>
        {spySection}
        {intelArtifactSection}
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
            {offenseSpells.map((s) => {
              const expected = realizedSpellMagnitude({
                baseStrength: s.baseStrength,
                caste: s.caste,
                spellType: s.type,
                magicLandCount: playerMagicLandCount,
                activeUpgrades: player.activeUpgrades ?? {},
                dice: 1.0,
              });
              return (
                <option key={s.id} value={s.id}>
                  T{s.tier} {s.name} · ~+{Math.round(expected)} atk power
                </option>
              );
            })}
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

      {offenseArtifactSection}
      {spySection}
      {intelArtifactSection}
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
