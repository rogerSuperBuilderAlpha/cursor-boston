/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useMemo, useState } from "react";
import { ARTIFACTS_BY_ID, getSpellsForCasteAndType } from "@/lib/game/content";
import type {
  CombatResult,
  GameArtifact,
  GamePlayer,
  GameTile,
  IntelReport,
  LandType,
  SpellDefinition,
  TurnReport,
  UnitType,
} from "@/lib/game/types";
import type { ThreatEntry } from "../_lib/threats-derive";
import { BattleReport } from "./BattleReport";

const UNIT_TYPES: UnitType[] = ["ground", "siege", "air"];
const LAND_TYPES: { type: LandType; label: string }[] = [
  { type: "military", label: "Military" },
  { type: "food", label: "Food" },
  { type: "magic", label: "Magic" },
  { type: "unassigned", label: "Unassigned" },
];

export interface ThreatRowProps {
  entry: ThreatEntry;
  player: GamePlayer;
  artifacts: ReadonlyArray<GameArtifact>;
  busy: boolean;
  onAttack: (args: {
    sourceTileId: string;
    targetTileId: string;
    units: { ground: number; siege: number; air: number };
    offenseSpellId: string | null;
  }) => Promise<{
    outcome: string;
    reportSummary: string;
    intelReport: IntelReport | null;
    combat: CombatResult | null;
    report: TurnReport | null;
    targetTile: GameTile | null;
  } | null>;
  onCastIntelSpell: (
    spellId: string,
    targetTileId: string
  ) => Promise<{ intelReport: unknown; detected: boolean } | null>;
  onUseArtifact: (
    artifactId: string,
    targetTileId: string | null
  ) => Promise<{ intelReport: IntelReport | null } | null>;
  onRecruit: (
    tileId: string,
    unitType: UnitType
  ) => Promise<{ produced: number; reportSummary: string } | null>;
  onArmDefenseSpell: (
    tileId: string,
    spellId: string
  ) => Promise<{ reportSummary: string } | null>;
  onDistributeTile: (
    tileId: string,
    type: LandType
  ) => Promise<{ reportSummary: string } | null>;
}

/**
 * One row in the Threats page: an enemy tile bordering my territory plus
 * every action that can change the matchup. Collapsed by default — the
 * Attack form is inline, everything else lives behind the expand chevron.
 *
 * Pre-checks: every action button computes its own `disabled + reason` from
 * the live player + tile + artifact state. The user never fires a button
 * that will 4xx out — the row tells them up-front why it's not allowed.
 */
export function ThreatRow(props: ThreatRowProps) {
  const { entry, player, artifacts, busy } = props;
  const [expanded, setExpanded] = useState(false);
  const [sourceTileId, setSourceTileId] = useState(entry.bestSource.tileId);
  const [ground, setGround] = useState(0);
  const [siege, setSiege] = useState(0);
  const [air, setAir] = useState(0);
  const [offenseSpellId, setOffenseSpellId] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);
  const [intelReport, setIntelReport] = useState<IntelReport | null>(null);
  // Structured battle readout shown after an attack lands. Replaces the
  // plain toast for attack actions; non-attack actions (recruit, arm, etc.)
  // still use the toast.
  const [battle, setBattle] = useState<{
    combat: CombatResult;
    report: TurnReport;
    targetTile: GameTile;
  } | null>(null);

  const source =
    entry.candidateSources.find((t) => t.tileId === sourceTileId) ??
    entry.bestSource;

  const myCaste = player.caste;
  const offenseSpells = useMemo<SpellDefinition[]>(
    () => (myCaste ? getSpellsForCasteAndType(myCaste, "offense") : []),
    [myCaste]
  );
  const defenseSpells = useMemo<SpellDefinition[]>(
    () => (myCaste ? getSpellsForCasteAndType(myCaste, "defense") : []),
    [myCaste]
  );
  const intelSpell = useMemo<SpellDefinition | null>(
    () =>
      myCaste
        ? getSpellsForCasteAndType(myCaste, "intel")[0] ?? null
        : null,
    [myCaste]
  );

  const offensiveArtifacts = artifacts.filter((a) => a.type === "offense");
  const defensiveArtifacts = artifacts.filter((a) => a.type === "defense");
  const intelArtifacts = artifacts.filter((a) => a.type === "intel");

  const enemyShielded = entry.enemyOwner?.shielded ?? false;
  const sentTotal = ground + siege + air;
  const attackTurnCost = 1 + (offenseSpellId ? 5 : 0);
  const attackDisabledReason = (() => {
    if (enemyShielded) return "Enemy shielded";
    if (sentTotal === 0) return "No units selected";
    if (ground > source.units.ground) return `Source has only ${source.units.ground} ground`;
    if (siege > source.units.siege) return `Source has only ${source.units.siege} siege`;
    if (air > source.units.air) return `Source has only ${source.units.air} air`;
    if (player.turnsRemaining < attackTurnCost)
      return `Need ${attackTurnCost} turns (you have ${player.turnsRemaining})`;
    if (player.phase !== "play") return "Not in play phase";
    return null;
  })();

  async function handleAttack() {
    setToast(null);
    setBattle(null);
    const res = await props.onAttack({
      sourceTileId: source.tileId,
      targetTileId: entry.enemyTile.tileId,
      units: { ground, siege, air },
      offenseSpellId: offenseSpellId || null,
    });
    if (res) {
      // If we have full combat detail + report + post-combat tile, render
      // the structured battle card. Otherwise (older server response) fall
      // back to a one-line toast.
      if (res.combat && res.report && res.targetTile) {
        setBattle({
          combat: res.combat,
          report: res.report,
          targetTile: res.targetTile,
        });
      } else {
        setToast(res.reportSummary || `Attack ${res.outcome}`);
      }
      setGround(0);
      setSiege(0);
      setAir(0);
      if (res.intelReport) setIntelReport(res.intelReport);
    }
  }

  async function handleCastIntel() {
    if (!intelSpell) return;
    setToast(null);
    const res = await props.onCastIntelSpell(
      intelSpell.id,
      entry.enemyTile.tileId
    );
    if (res?.intelReport) {
      setIntelReport(res.intelReport as IntelReport);
      setToast(`Intel captured · detected: ${res.detected ? "yes" : "no"}`);
    }
  }

  async function handleUseArtifact(
    artifact: GameArtifact,
    targetTileId: string | null
  ) {
    setToast(null);
    const res = await props.onUseArtifact(artifact.id, targetTileId);
    if (res) {
      const def = ARTIFACTS_BY_ID.get(artifact.definitionId);
      setToast(`Used ${def?.name ?? "artifact"}`);
      if (res.intelReport) setIntelReport(res.intelReport);
    }
  }

  async function handleRecruit(unitType: UnitType) {
    setToast(null);
    const res = await props.onRecruit(source.tileId, unitType);
    if (res) setToast(res.reportSummary || `+${res.produced} ${unitType}`);
  }

  async function handleArm(spellId: string) {
    setToast(null);
    const res = await props.onArmDefenseSpell(source.tileId, spellId);
    if (res) setToast(res.reportSummary || "Armed");
  }

  async function handleAssign(type: LandType) {
    setToast(null);
    const res = await props.onDistributeTile(source.tileId, type);
    if (res) setToast(res.reportSummary || `Tile set to ${type}`);
  }

  const enemyName = entry.enemyOwner?.displayName ?? entry.enemyTile.ownerId?.slice(0, 6) ?? "??";
  const enemyCasteLabel = entry.enemyOwner?.caste
    ? entry.enemyOwner.caste.charAt(0).toUpperCase() + entry.enemyOwner.caste.slice(1)
    : "—";
  const advantageLabel =
    entry.myAdvantage >= 1
      ? `${entry.myAdvantage.toFixed(1)}×`
      : `1 / ${(1 / entry.myAdvantage).toFixed(1)}×`;
  const advantageTone =
    entry.myAdvantage >= 2
      ? "text-emerald-600 dark:text-emerald-400"
      : entry.myAdvantage >= 1
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      {/* ─── Compact summary line ─────────────────────────────────────────── */}
      <div className="px-4 py-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▾" : "▸"}
        </button>
        <span className="font-mono font-semibold">{entry.enemyTile.tileId}</span>
        <span className="text-neutral-600 dark:text-neutral-300">
          {enemyName} · {enemyCasteLabel}
        </span>
        <span className="font-mono text-xs text-neutral-500">
          G{entry.enemyTile.units.ground} S{entry.enemyTile.units.siege} A{entry.enemyTile.units.air}
        </span>
        {enemyShielded && (
          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs">
            shielded
          </span>
        )}
        <span className={`font-semibold ${advantageTone}`}>
          adv {advantageLabel}
        </span>
      </div>

      {/* ─── Source prep strip — always visible (assign + recruit) ──────── */}
      <div className="px-4 pb-2 space-y-1.5">
        {/* Assign land type */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-neutral-500 mr-1">Assign source · 1t:</span>
          {LAND_TYPES.map((a) => {
            const isCurrent = source.type === a.type;
            const cantSpend = player.turnsRemaining < 1;
            const reason = isCurrent
              ? `Already ${a.label.toLowerCase()}`
              : cantSpend
                ? "Need 1 turn"
                : null;
            return (
              <button
                key={a.type}
                onClick={() => handleAssign(a.type)}
                disabled={busy || reason !== null}
                title={reason ?? `Set source to ${a.label.toLowerCase()}`}
                className={`px-2 py-1 rounded border ${
                  isCurrent
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                    : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                } disabled:opacity-50`}
              >
                {a.label}
              </button>
            );
          })}
        </div>
        {/* Recruit */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-neutral-500 mr-1">Recruit · 5t:</span>
          {UNIT_TYPES.map((u) => {
            const reason =
              source.type !== "military"
                ? "Tile is not military — assign first"
                : player.turnsRemaining < 5
                  ? "Need 5 turns"
                  : null;
            return (
              <button
                key={u}
                onClick={() => handleRecruit(u)}
                disabled={busy || reason !== null}
                title={reason ?? `Recruit +10 ${u} on source`}
                className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 capitalize"
              >
                +10 {u}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Inline attack form (visible always) ─────────────────────────── */}
      <div className="px-4 pb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1fr)] items-end">
          <label className="text-xs">
            <span className="text-neutral-500 block mb-0.5">Source</span>
            <select
              value={sourceTileId}
              onChange={(e) => setSourceTileId(e.target.value)}
              className="w-full px-2 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm"
            >
              {entry.candidateSources.map((t) => (
                <option key={t.tileId} value={t.tileId}>
                  {t.tileId} ({t.type}) — G{t.units.ground} S{t.units.siege} A{t.units.air}
                </option>
              ))}
            </select>
          </label>
          <UnitInput
            label={`G/${source.units.ground}`}
            value={ground}
            max={source.units.ground}
            onChange={setGround}
          />
          <UnitInput
            label={`S/${source.units.siege}`}
            value={siege}
            max={source.units.siege}
            onChange={setSiege}
          />
          <UnitInput
            label={`A/${source.units.air}`}
            value={air}
            max={source.units.air}
            onChange={setAir}
          />
          <label className="text-xs">
            <span className="text-neutral-500 block mb-0.5">Spell (+5t)</span>
            <select
              value={offenseSpellId}
              onChange={(e) => setOffenseSpellId(e.target.value)}
              className="w-full px-2 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm"
            >
              <option value="">— none —</option>
              {offenseSpells.map((s) => (
                <option key={s.id} value={s.id}>
                  T{s.tier} {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          onClick={handleAttack}
          disabled={busy || attackDisabledReason !== null}
          title={attackDisabledReason ?? `Costs ${attackTurnCost} turns`}
          className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors disabled:opacity-50"
        >
          Attack ({attackTurnCost}t)
        </button>
      </div>
      {attackDisabledReason && (
        <div className="px-4 pb-2 text-xs text-neutral-500">
          Attack disabled: {attackDisabledReason}.
        </div>
      )}

      {/* ─── Battle report (full structured readout after an attack) ─────── */}
      {battle && (
        <div className="mx-4 mb-3">
          <BattleReport
            combat={battle.combat}
            report={battle.report}
            targetTile={battle.targetTile}
            onDismiss={() => setBattle(null)}
          />
        </div>
      )}

      {/* ─── Toast (one-line result for non-attack actions) ──────────────── */}
      {toast && (
        <div className="mx-4 mb-3 px-3 py-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2">
          <span>{toast}</span>
          <button
            onClick={() => setToast(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* ─── Intel report (rendered when populated by spy / intel artifact) ─ */}
      {intelReport && (
        <div className="mx-4 mb-3">
          <ThreatIntelPanel
            report={intelReport}
            onDismiss={() => setIntelReport(null)}
          />
        </div>
      )}

      {/* ─── Expanded action panels ──────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-neutral-200 dark:border-neutral-800 px-4 py-3 space-y-4">
          {/* Spy + intel artifacts */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
              Spy / intel
            </h3>
            <div className="flex flex-wrap gap-2">
              {intelSpell && (
                <SpyButton
                  spell={intelSpell}
                  player={player}
                  busy={busy}
                  onCast={handleCastIntel}
                />
              )}
              {intelArtifacts.length === 0 && !intelSpell && (
                <p className="text-xs text-neutral-500">
                  No caste intel spell or intel artifacts available.
                </p>
              )}
              {intelArtifacts.map((a) => {
                const def = ARTIFACTS_BY_ID.get(a.definitionId);
                return (
                  <button
                    key={a.id}
                    onClick={() => handleUseArtifact(a, entry.enemyTile.tileId)}
                    disabled={busy}
                    title={def?.description ?? a.definitionId}
                    className="px-3 py-1.5 text-xs rounded border border-violet-300 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950/30 disabled:opacity-50"
                  >
                    Use {def?.name ?? a.definitionId}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Offensive artifacts (used on enemy tile) */}
          {offensiveArtifacts.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
                Offensive artifacts (on enemy)
              </h3>
              <div className="flex flex-wrap gap-2">
                {offensiveArtifacts.map((a) => {
                  const def = ARTIFACTS_BY_ID.get(a.definitionId);
                  return (
                    <button
                      key={a.id}
                      onClick={() =>
                        handleUseArtifact(a, entry.enemyTile.tileId)
                      }
                      disabled={busy}
                      title={def?.description ?? a.definitionId}
                      className="px-3 py-1.5 text-xs rounded border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                    >
                      Use {def?.name ?? a.definitionId}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Manage source tile — defense-side only.
              Assign + recruit live in the always-visible strip up top. */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
              Defend source · {source.tileId} ({source.type})
            </h3>

            <div className="space-y-3">
              {/* Arm defense spell */}
              {defenseSpells.length > 0 && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1">
                    Arm defense spell — 5 turns
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {defenseSpells.map((s) => {
                      const reason =
                        source.armedDefenseSpellId === s.id
                          ? "Already armed"
                          : player.turnsRemaining < 5
                            ? "Need 5 turns"
                            : player.stats.tilesHeld < s.minTilesRequired
                              ? `Need ${s.minTilesRequired} tiles`
                              : null;
                      return (
                        <button
                          key={s.id}
                          onClick={() => handleArm(s.id)}
                          disabled={busy || reason !== null}
                          title={reason ?? s.description}
                          className="px-3 py-1.5 text-xs rounded border border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-50"
                        >
                          T{s.tier} {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Defense artifacts (on source tile) */}
              {defensiveArtifacts.length > 0 && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1">
                    Defense artifacts (on source)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {defensiveArtifacts.map((a) => {
                      const def = ARTIFACTS_BY_ID.get(a.definitionId);
                      return (
                        <button
                          key={a.id}
                          onClick={() => handleUseArtifact(a, source.tileId)}
                          disabled={busy}
                          title={def?.description ?? a.definitionId}
                          className="px-3 py-1.5 text-xs rounded border border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-50"
                        >
                          Use {def?.name ?? a.definitionId}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
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
    <label className="text-xs">
      <span className="text-neutral-500 block mb-0.5">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          onChange(Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0);
        }}
        className="w-20 px-2 py-1.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm"
      />
    </label>
  );
}

function SpyButton({
  spell,
  player,
  busy,
  onCast,
}: {
  spell: SpellDefinition;
  player: GamePlayer;
  busy: boolean;
  onCast: () => void;
}) {
  const reason =
    player.turnsRemaining < spell.turnCost
      ? `Need ${spell.turnCost} turns`
      : player.stats.tilesHeld < spell.minTilesRequired
        ? `Need ${spell.minTilesRequired} tiles`
        : null;
  return (
    <button
      onClick={onCast}
      disabled={busy || reason !== null}
      title={reason ?? spell.description}
      className="px-3 py-1.5 text-xs rounded border border-violet-300 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950/30 disabled:opacity-50"
    >
      Spy: {spell.name} ({spell.turnCost}t)
    </button>
  );
}

function ThreatIntelPanel({
  report,
  onDismiss,
}: {
  report: IntelReport;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-lg border-2 border-violet-300 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/30 p-3 space-y-2 text-xs">
      <div className="flex items-baseline justify-between">
        <h4 className="font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
          Intel · {report.targetTileId}
        </h4>
        <button
          onClick={onDismiss}
          className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Dismiss
        </button>
      </div>
      <p>
        {report.target.landType} · G{report.target.units.ground} S
        {report.target.units.siege} A{report.target.units.air}
        {report.target.armedDefenseSpellId
          ? ` · armed: ${report.target.armedDefenseSpellId}`
          : ""}
      </p>
      {report.weakFace && (
        <p>
          Forge Sight: lead with <strong>{report.weakFace}</strong>.
        </p>
      )}
      {report.kingdomDefender && (
        <p>
          Kingdom: {report.kingdomDefender.tilesHeld} tiles ·{" "}
          {report.kingdomDefender.unitsAlive} units ·{" "}
          {report.kingdomDefender.artifactCount} artifacts.
        </p>
      )}
      {report.supply && (
        <p>
          Supply ×{report.supply.supplyMultiplier.toFixed(2)} (
          {report.supply.friendlyNeighbors.length} friendly tiles).
        </p>
      )}
    </div>
  );
}
