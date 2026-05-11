/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useMemo, useState } from "react";
import { unitsPerCycleForLand } from "@/app/game/recruit/_lib/constants";
import { ARTIFACTS_BY_ID, getSpellsForCasteAndType } from "@/lib/game/content";
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
import type { ThreatEntry } from "../_lib/threats-derive";
import { useAttackPreview } from "../_lib/use-attack-preview";
import { BattleReport } from "./BattleReport";
import { BattleSimPanel } from "./BattleSimPanel";
import { BoostPanel } from "./BoostPanel";
import { ChangeSourceModal } from "./ChangeSourceModal";
import { ManageSourcePanel } from "./ManageSourcePanel";
import { SourceTileCard } from "./SourceTileCard";
import { SpellPicker } from "./SpellPicker";

export interface ThreatRowProps {
  entry: ThreatEntry;
  player: GamePlayer;
  artifacts: ReadonlyArray<GameArtifact>;
  busy: boolean;
  /** Open the row's full attack flow on first render. Top-N rows by
   *  advantage are auto-expanded by the page; the rest stay collapsed
   *  to keep the list scannable. User can still toggle manually. */
  defaultExpanded?: boolean;
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
  const { entry, player, artifacts, busy, myMagicLandCount, defaultExpanded } =
    props;
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const [activeTab, setActiveTab] = useState<"attack" | "defense">("attack");
  const [sourceTileId, setSourceTileId] = useState(entry.bestSource.tileId);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  // Offensive artifact queued for this swing. The artifact is NOT
  // consumed until handleAttack fires — clicking the card just stages
  // it (visual ring), and clicking the same card again clears it.
  const [queuedArtifactId, setQueuedArtifactId] = useState<string>("");
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
    // Consume a queued artifact (if any) before the swing fires. We
    // await so the server-side intel/offense effect is in place by the
    // time the attack resolves. If the use-artifact call fails, abort —
    // the user shouldn't lose units to a half-applied bonus.
    if (queuedArtifactId) {
      const a = artifacts.find((x) => x.id === queuedArtifactId);
      if (a) {
        const useRes = await props.onUseArtifact(
          a.id,
          entry.enemyTile.tileId
        );
        if (!useRes) return;
        if (useRes.intelReport) setIntelReport(useRes.intelReport);
      }
    }
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
      setQueuedArtifactId("");
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

  const recentOutcomes =
    Boolean(battle) || Boolean(toast) || Boolean(intelReport);

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      {/* ── Summary line: click the chevron to expand the full attack flow ─ */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-left hover:bg-neutral-50 dark:hover:bg-neutral-900/40"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse row" : "Expand row"}
      >
        <span className="text-neutral-500 shrink-0">
          {expanded ? "▾" : "▸"}
        </span>
        <span className="font-mono font-semibold">{entry.enemyTile.tileId}</span>
        <span className="text-neutral-600 dark:text-neutral-300">
          {enemyName} · {enemyCasteLabel}
        </span>
        <span className="font-mono text-xs text-neutral-500">
          G{entry.enemyTile.units.ground} S{entry.enemyTile.units.siege} A
          {entry.enemyTile.units.air}
        </span>
        {enemyShielded && (
          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs">
            shielded
          </span>
        )}
        <span className={`font-semibold ${advantageTone}`}>
          adv {advantageLabel}
        </span>
        {!expanded && (
          <span className="ml-auto text-xs text-neutral-500">
            Plan attack →
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-neutral-200 dark:border-neutral-800">
          {/* Row-level mode tabs — Attack (plan/launch the strike) vs.
              Defense (beef up the source tile). Picking the right mode
              up front keeps each tab clean and focused. */}
          <div className="flex gap-1 px-3 pt-3" role="tablist">
            <TabButton
              active={activeTab === "attack"}
              tone="red"
              onClick={() => setActiveTab("attack")}
            >
              ⚔️ Attack
            </TabButton>
            <TabButton
              active={activeTab === "defense"}
              tone="blue"
              onClick={() => setActiveTab("defense")}
            >
              🛡 Defense
            </TabButton>
          </div>

          {activeTab === "attack" && (() => {
            const recruitYield = unitsPerCycleForLand(source.type);
            const recruitDisabledReason =
              recruitYield <= 0
                ? "Assign a land type to this tile first (Defense tab)"
                : player.turnsRemaining < 5
                  ? `Need 5 turns (you have ${player.turnsRemaining})`
                  : null;
            return (
            <div className="px-4 py-3 space-y-4">
              {/* Row 1 — source tile card on the left + three unit columns
                  (input over +N recruit button) on the right. Labels
                  ("G/20" etc.) sit ABOVE the box stack so the source-tile
                  card and the input-over-button stack share the same
                  height beneath the label row. */}
              <div className="grid gap-3 grid-cols-[minmax(0,1fr)_auto_auto_auto] items-stretch">
                {/* Source column — invisible label-height spacer above
                    the card so the card aligns with the unit input
                    boxes, not the labels. */}
                <div className="flex flex-col">
                  <span
                    aria-hidden="true"
                    className="text-xs mb-1 invisible select-none"
                  >
                    ·
                  </span>
                  {myCaste && (
                    <div className="flex-1">
                      <SourceTileCard
                        source={source}
                        myCaste={myCaste}
                        candidateCount={entry.candidateSources.length}
                        isBest={source.tileId === entry.bestSource.tileId}
                        onOpenPicker={() => setSourcePickerOpen(true)}
                      />
                    </div>
                  )}
                </div>
                <UnitWithRecruit
                  label={`G/${source.units.ground}`}
                  value={ground}
                  max={source.units.ground}
                  onChange={setGround}
                  recruitYield={recruitYield}
                  recruitDisabledReason={recruitDisabledReason}
                  busy={busy}
                  onRecruit={() => void handleRecruit("ground")}
                />
                <UnitWithRecruit
                  label={`S/${source.units.siege}`}
                  value={siege}
                  max={source.units.siege}
                  onChange={setSiege}
                  recruitYield={recruitYield}
                  recruitDisabledReason={recruitDisabledReason}
                  busy={busy}
                  onRecruit={() => void handleRecruit("siege")}
                />
                <UnitWithRecruit
                  label={`A/${source.units.air}`}
                  value={air}
                  max={source.units.air}
                  onChange={setAir}
                  recruitYield={recruitYield}
                  recruitDisabledReason={recruitDisabledReason}
                  busy={busy}
                  onRecruit={() => void handleRecruit("air")}
                />
              </div>

              {/* Row 2 — Boost (left) | Spell picker (right). Both are
                  "optional modifiers" on the swing, so pairing them visually
                  reinforces that they're the player's tuning levers. The
                  grid stretches both boxes to the same height. */}
              <div className="grid gap-4 lg:grid-cols-2 items-stretch">
                <BoostPanel
                  busy={busy}
                  offensiveArtifacts={offensiveArtifacts.map((a) => ({
                    artifact: a,
                    definition: ARTIFACTS_BY_ID.get(a.definitionId) ?? null,
                  }))}
                  intelArtifacts={intelArtifacts.map((a) => ({
                    artifact: a,
                    definition: ARTIFACTS_BY_ID.get(a.definitionId) ?? null,
                  }))}
                  queuedArtifactId={queuedArtifactId}
                  onQueueArtifact={(id) => setQueuedArtifactId(id)}
                  onUseIntelArtifact={(artifactId) => {
                    const a = artifacts.find((x) => x.id === artifactId);
                    if (a) void handleUseArtifact(a, entry.enemyTile.tileId);
                  }}
                  spy={
                    intelSpell
                      ? {
                          spell: intelSpell,
                          onClick: () => void handleCastIntel(),
                          disabledReason:
                            player.turnsRemaining < intelSpell.turnCost
                              ? `Need ${intelSpell.turnCost} turns (you have ${player.turnsRemaining})`
                              : player.stats.tilesHeld < intelSpell.minTilesRequired
                                ? `Need ${intelSpell.minTilesRequired} tiles held`
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
                />
                <SpellPicker
                  spells={offenseSpells}
                  expectedById={offenseSpellPreviews}
                  selectedSpellId={offenseSpellId}
                  onSelect={setOffenseSpellId}
                />
              </div>

              {/* Row 3 — Projected outcome (left) + big Attack call-to-action
                  (right). The CTA mirrors the projection's height so the
                  player's eye lands on it the moment they're happy with the
                  preview. */}
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-stretch">
                <BattleSimPanel
                  selectedOffenseSpell={null}
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
                />
                <button
                  onClick={handleAttack}
                  disabled={busy || attackDisabledReason !== null}
                  title={attackDisabledReason ?? `Costs ${attackTurnCost} turns`}
                  className="rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-2 p-6 min-h-[180px]"
                >
                  <span className="text-3xl leading-none">⚔️</span>
                  <span className="text-xl tracking-wide">ATTACK</span>
                  <span className="text-sm font-medium opacity-80">
                    {attackTurnCost} turn{attackTurnCost === 1 ? "" : "s"}
                  </span>
                  {attackDisabledReason && (
                    <span className="text-[11px] font-normal opacity-90 text-center px-2 mt-1">
                      {attackDisabledReason}
                    </span>
                  )}
                </button>
              </div>
            </div>
            );
          })()}

          {sourcePickerOpen && myCaste && (
            <ChangeSourceModal
              candidates={entry.candidateSources}
              myCaste={myCaste}
              currentSourceId={source.tileId}
              bestSourceId={entry.bestSource.tileId}
              targetTileId={entry.enemyTile.tileId}
              onSelect={(id) => setSourceTileId(id)}
              onClose={() => setSourcePickerOpen(false)}
            />
          )}

          {activeTab === "defense" && (
            <div className="px-4 py-3">
              <ManageSourcePanel
                source={source}
                player={player}
                busy={busy}
                defenseSpells={defenseSpells}
                defensiveArtifacts={defensiveArtifacts.map((a) => ({
                  artifact: a,
                  definition: ARTIFACTS_BY_ID.get(a.definitionId) ?? null,
                }))}
                onAssign={(t) => void handleAssign(t)}
                onRecruit={(u) => void handleRecruit(u)}
                onArmDefenseSpell={(spellId) => void handleArm(spellId)}
                onUseDefensiveArtifact={(artifactId) => {
                  const a = artifacts.find((x) => x.id === artifactId);
                  if (a) void handleUseArtifact(a, source.tileId);
                }}
              />
            </div>
          )}

          {/* ── RECENT OUTCOMES (full-width, below the tab content) ─────── */}
          {recentOutcomes && (
            <section className="px-4 py-3 space-y-2 border-t border-neutral-100 dark:border-neutral-900/60">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Recent outcomes
              </h3>
              {battle && (
                <BattleReport
                  combat={battle.combat}
                  report={battle.report}
                  targetTile={battle.targetTile}
                  onDismiss={() => setBattle(null)}
                />
              )}
              {intelReport && (
                <ThreatIntelPanel
                  report={intelReport}
                  onDismiss={() => setIntelReport(null)}
                />
              )}
              {toast && (
                <div className="px-3 py-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2">
                  <span>{toast}</span>
                  <button
                    onClick={() => setToast(null)}
                    className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200"
                  >
                    ✕
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "red" | "blue";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeCls =
    tone === "red"
      ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-200"
      : "border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-200";
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-4 py-1.5 text-sm font-semibold rounded-t-md border-x border-t -mb-px transition-colors ${
        active
          ? activeCls
          : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
      }`}
    >
      {children}
    </button>
  );
}

function UnitWithRecruit({
  label,
  value,
  max,
  onChange,
  recruitYield,
  recruitDisabledReason,
  busy,
  onRecruit,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (n: number) => void;
  recruitYield: number;
  recruitDisabledReason: string | null;
  busy: boolean;
  onRecruit: () => void;
}) {
  // When recruitYield is 0 the source tile can't actually produce that unit
  // (no land type assigned). Show "+10" so the column width stays
  // consistent, but disable the button — the tooltip carries the why.
  const buttonLabel = recruitYield > 0 ? `+${recruitYield}` : "+10";
  const inputId = `units-${label.replace(/[^a-z0-9]/gi, "-")}`;
  return (
    <div className="flex flex-col w-24">
      <label
        htmlFor={inputId}
        className="text-xs text-neutral-500 mb-1 truncate"
      >
        {label}
      </label>
      <input
        id={inputId}
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          onChange(Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0);
        }}
        className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-base font-medium"
      />
      <button
        type="button"
        onClick={onRecruit}
        disabled={busy || recruitDisabledReason !== null}
        title={recruitDisabledReason ?? `Recruit ${buttonLabel} on this tile (5 turns)`}
        className="mt-1 w-full px-3 py-2 text-sm rounded border border-emerald-400 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
      >
        {buttonLabel} · 5t
      </button>
    </div>
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
