/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useMemo, useState } from "react";
import { ARTIFACTS_BY_ID, getSpellsForCasteAndType } from "@/lib/game/content";
import { CatalogImage } from "@/app/game/_components/CatalogImage";
import { realizedSpellMagnitude } from "@/lib/game/combat";
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
import { unitsPerCycleForLand } from "@/app/game/recruit/_lib/constants";
import type { ThreatEntry } from "../_lib/threats-derive";
import { useAttackPreview } from "../_lib/use-attack-preview";
import { BattleReport } from "./BattleReport";
import { BattleSimPanel } from "./BattleSimPanel";

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
  // Count of the player's magic-land tiles. Drives the magic multiplier
  // in the spell-cast picker's expected-magnitude readout. Passed from
  // the page so the row doesn't need the full tile list.
  myMagicLandCount: number;
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
  onSiege: (
    sourceTileId: string,
    targetTileId: string
  ) => Promise<{
    reportSummary: string;
    siegeTotalMagnitude: number;
  } | null>;
  onFlyover: (
    sourceTileId: string,
    targetTileId: string,
    units: { ground: number; siege: number; air: number }
  ) => Promise<{
    reportSummary: string;
    combat: CombatResult | null;
    report: TurnReport | null;
    targetTile: GameTile | null;
  } | null>;
  onCastSpell: (
    spellId: string,
    sourceTileId: string,
    targetTileId: string
  ) => Promise<{
    reportSummary: string;
    siege?: { magnitudeApplied: number; totalMagnitudeAfter: number };
    disarm?: { fractionApplied: number };
    attrition?: { unitsKilled: { ground: number; siege: number; air: number } };
  } | null>;
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
  const { entry, player, artifacts, busy, myMagicLandCount } = props;
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
  // Show only spells the player has actually unlocked (tilesHeld gate).
  // Turn-budget is a per-attack check applied by `attackDisabledReason` once
  // a spell is selected, so we keep visibility broad enough that the player
  // still sees freshly-unlocked spells even with a low turn count.
  const offenseSpells = useMemo<SpellDefinition[]>(
    () =>
      myCaste
        ? getSpellsForCasteAndType(myCaste, "offense").filter(
            (s) => player.stats.tilesHeld >= s.minTilesRequired
          )
        : [],
    [myCaste, player.stats.tilesHeld]
  );
  // Compute expected midpoint magnitude (flat attack-power add) per spell so
  // the option label can preview the effect and the BattleSimPanel can show
  // the selected spell's full description+lore inline.
  const offenseSpellPreviews = useMemo(() => {
    if (!myCaste) return new Map<string, number>();
    const out = new Map<string, number>();
    for (const s of offenseSpells) {
      out.set(
        s.id,
        realizedSpellMagnitude({
          baseStrength: s.baseStrength,
          caste: s.caste,
          spellType: s.type,
          magicLandCount: myMagicLandCount,
          activeUpgrades: player.activeUpgrades ?? {},
          dice: 1.0,
        })
      );
    }
    return out;
  }, [myCaste, offenseSpells, myMagicLandCount, player.activeUpgrades]);
  const selectedOffenseSpell: SpellDefinition | null = useMemo(
    () =>
      offenseSpellId
        ? offenseSpells.find((s) => s.id === offenseSpellId) ?? null
        : null,
    [offenseSpellId, offenseSpells]
  );
  const selectedOffenseExpected: number | null = selectedOffenseSpell
    ? offenseSpellPreviews.get(selectedOffenseSpell.id) ?? null
    : null;
  const defenseSpells = useMemo<SpellDefinition[]>(
    () => (myCaste ? getSpellsForCasteAndType(myCaste, "defense") : []),
    [myCaste]
  );
  const siegeSpell = useMemo<SpellDefinition | null>(
    () =>
      myCaste
        ? getSpellsForCasteAndType(myCaste, "siege")[0] ?? null
        : null,
    [myCaste]
  );
  const disarmSpell = useMemo<SpellDefinition | null>(
    () =>
      myCaste
        ? getSpellsForCasteAndType(myCaste, "disarm")[0] ?? null
        : null,
    [myCaste]
  );
  const attritionSpell = useMemo<SpellDefinition | null>(
    () =>
      myCaste
        ? getSpellsForCasteAndType(myCaste, "attrition")[0] ?? null
        : null,
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
  // Drive the turn-cost off the effective id (computed below) so a stale
  // selection whose spell no longer resolves doesn't quote the wrong cost.
  // Forward-reference is fine: effectiveOffenseSpellId is derived directly
  // from selectedOffenseSpell which is already memoized above.
  const attackTurnCost = 1 + (selectedOffenseSpell ? 5 : 0);
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

  // Battle simulation preview — fires for every (source, units, spell) tweak
  // unless the matchup is structurally impossible (shielded enemy, wrong
  // phase). Insufficient turns / cap overflow don't gate the preview, since
  // the player can recover by adjusting before they actually swing.
  const previewDisabled =
    enemyShielded || player.phase !== "play";
  // Bumped on every successful pre-action (spy / siege / flyover) so the
  // preview refetches even when the form fields haven't changed — those
  // actions mutate server-side intel-effects that the projection reads.
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);

  // The "effective" id we send to the preview and attack APIs. If the
  // staged offenseSpellId no longer resolves to a castable spell (e.g.
  // tilesHeld dropped below its minTilesRequired since selection), fall
  // back to none. Derived at use rather than via a cleanup effect so we
  // don't trigger a cascading render.
  const effectiveOffenseSpellId = selectedOffenseSpell ? selectedOffenseSpell.id : null;

  const attackPreview = useAttackPreview({
    sourceTileId: source.tileId,
    targetTileId: entry.enemyTile.tileId,
    units: { ground, siege, air },
    offenseSpellId: effectiveOffenseSpellId,
    disabled: previewDisabled,
    refreshKey: previewRefreshKey,
  });

  async function handleAttack() {
    setToast(null);
    setBattle(null);
    const res = await props.onAttack({
      sourceTileId: source.tileId,
      targetTileId: entry.enemyTile.tileId,
      units: { ground, siege, air },
      offenseSpellId: effectiveOffenseSpellId,
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
      // Forge Sight (Red caste) creates a forge-sight-offense effect that
      // tightens the projection; bump so the panel re-fetches.
      setPreviewRefreshKey((k) => k + 1);
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

  async function handleSiegeFromPanel() {
    setToast(null);
    const res = await props.onSiege(source.tileId, entry.enemyTile.tileId);
    if (res) {
      setToast(
        `${res.reportSummary} · total siege −${(
          res.siegeTotalMagnitude * 100
        ).toFixed(0)}%`
      );
      setPreviewRefreshKey((k) => k + 1);
    }
  }

  async function handleCastSpellFromPanel(spellId: string) {
    setToast(null);
    const res = await props.onCastSpell(
      spellId,
      source.tileId,
      entry.enemyTile.tileId
    );
    if (res) {
      setToast(res.reportSummary || "Spell cast");
      setPreviewRefreshKey((k) => k + 1);
    }
  }

  async function handleFlyoverFromPanel() {
    setToast(null);
    setBattle(null);
    const res = await props.onFlyover(source.tileId, entry.enemyTile.tileId, {
      ground: 0,
      siege: 0,
      air,
    });
    if (res) {
      if (res.combat && res.report && res.targetTile) {
        setBattle({
          combat: res.combat,
          report: res.report,
          targetTile: res.targetTile,
        });
      } else {
        setToast(res.reportSummary || "Flyover");
      }
      setAir(0);
      setPreviewRefreshKey((k) => k + 1);
    }
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
        {/* Recruit — military/food/magic recruit at different rates;
            unrevealed/unassigned can't recruit (must assign first). */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-neutral-500 mr-1">Recruit · 5t:</span>
          {UNIT_TYPES.map((u) => {
            const yieldPerCycle = unitsPerCycleForLand(source.type);
            const reason =
              yieldPerCycle <= 0
                ? "Tile cannot recruit — assign land type first"
                : player.turnsRemaining < 5
                  ? "Need 5 turns"
                  : null;
            return (
              <button
                key={u}
                onClick={() => handleRecruit(u)}
                disabled={busy || reason !== null}
                title={
                  reason ?? `Recruit +${yieldPerCycle} ${u} on source`
                }
                className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 capitalize"
              >
                +{yieldPerCycle || 10} {u}
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
              {offenseSpells.map((s) => {
                const expected = offenseSpellPreviews.get(s.id);
                const fx =
                  expected !== undefined
                    ? ` · ~+${Math.round(expected)} atk power`
                    : "";
                return (
                  <option key={s.id} value={s.id}>
                    T{s.tier} {s.name}{fx}
                  </option>
                );
              })}
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

      {/* ─── Battle simulation panel (live projection) ───────────────────── */}
      <div className="mx-4">
        <BattleSimPanel
          selectedOffenseSpell={
            selectedOffenseSpell
              ? {
                  spell: selectedOffenseSpell,
                  expectedMagnitude: selectedOffenseExpected ?? 0,
                }
              : null
          }
          preview={attackPreview.preview}
          loading={attackPreview.loading}
          error={attackPreview.error}
          disabled={previewDisabled}
          disabledReason={
            previewDisabled
              ? enemyShielded
                ? "Enemy is shielded — no preview while shielded."
                : "Not in play phase — preview unavailable."
              : undefined
          }
          busy={busy}
          spy={
            intelSpell
              ? {
                  onClick: () => void handleCastIntel(),
                  turnCost: intelSpell.turnCost,
                  disabledReason:
                    player.turnsRemaining < intelSpell.turnCost
                      ? `Need ${intelSpell.turnCost} turns (you have ${player.turnsRemaining})`
                      : null,
                }
              : undefined
          }
          siege={{
            onClick: () => void handleSiegeFromPanel(),
            turnCost: 5,
            disabledReason:
              player.turnsRemaining < 5
                ? `Need 5 turns (you have ${player.turnsRemaining})`
                : null,
          }}
          flyover={{
            onClick: () => void handleFlyoverFromPanel(),
            turnCost: 1,
            airUnits: air,
            disabledReason: (() => {
              if (air <= 0) return "Set air units in the form first";
              if (air > source.units.air)
                return `Source has only ${source.units.air} air`;
              if (player.turnsRemaining < 1)
                return `Need 1 turn (you have ${player.turnsRemaining})`;
              return null;
            })(),
          }}
          castSpell={(() => {
            // Build the picker entries for the player's caste-specific
            // tier-1 spells of the new kinds. Expected magnitude uses
            // dice=1.0 (midpoint of [0.5, 1.5]) so the player sees the
            // average outcome before the actual roll.
            const ownedMagic = myMagicLandCount;
            const turnCost = 5;
            const baseDisabled =
              player.turnsRemaining < turnCost
                ? `Need ${turnCost} turns (you have ${player.turnsRemaining})`
                : null;
            const candidates: SpellDefinition[] = [
              siegeSpell,
              disarmSpell,
              attritionSpell,
            ].filter((s): s is SpellDefinition => s !== null);
            return {
              spells: candidates.map((s) => {
                const expected = realizedSpellMagnitude({
                  baseStrength: s.baseStrength,
                  caste: s.caste,
                  spellType: s.type,
                  magicLandCount: ownedMagic,
                  activeUpgrades: player.activeUpgrades ?? {},
                  dice: 1.0,
                });
                let entryDisabled = baseDisabled;
                if (
                  !entryDisabled &&
                  player.stats.tilesHeld < s.minTilesRequired
                ) {
                  entryDisabled = `Need ${s.minTilesRequired} tiles held (you have ${player.stats.tilesHeld})`;
                }
                return {
                  spell: s,
                  expectedMagnitude: expected,
                  disabledReason: entryDisabled,
                };
              }),
              onCast: (spellId) => void handleCastSpellFromPanel(spellId),
              turnCost,
              disabledReason:
                candidates.length === 0
                  ? "No castable spells for your caste"
                  : baseDisabled,
            };
          })()}
        />
      </div>

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
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded border border-violet-300 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950/30 disabled:opacity-50"
                  >
                    <CatalogImage entry={def ?? { name: a.definitionId }} size="xs" />
                    <span>Use {def?.name ?? a.definitionId}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Offensive artifacts (used on enemy tile) */}
          {offensiveArtifacts.length > 0 && (
            <section>
              <h3 className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                Offensive artifacts (on enemy) · one-time use
              </h3>
              <p className="text-[11px] text-neutral-500 mb-2">
                Spent before your attack — the bonus applies to your next swing.
              </p>
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
                      className="flex items-center gap-2 px-2 py-1.5 text-xs rounded border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                    >
                      <CatalogImage entry={def ?? { name: a.definitionId }} size="xs" />
                      <span>Use {def?.name ?? a.definitionId}</span>
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
                          className="flex items-center gap-2 px-3 py-1.5 text-xs rounded border border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-50"
                        >
                          <CatalogImage entry={s} size="xs" />
                          <span>T{s.tier} {s.name}</span>
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
                    Defense artifacts (on source) · one-time use
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
                          className="flex items-center gap-2 px-2 py-1.5 text-xs rounded border border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-50"
                        >
                          <CatalogImage entry={def ?? { name: a.definitionId }} size="xs" />
                          <span>Use {def?.name ?? a.definitionId}</span>
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
