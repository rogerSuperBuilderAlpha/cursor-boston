/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type {
  ArtifactDefinition,
  AttackOutcome,
  CombatResult,
  GameHero,
  GameTile,
  LandType,
  TurnReport,
  UnitStack,
  UnitType,
} from "./types";
import {
  ATTACK_CAPTURED_CLOSERS,
  ATTACK_MIDDLES,
  ATTACK_OPENINGS,
  ATTACK_REPELLED_CLOSERS,
  ATTACK_STALEMATE_CLOSERS,
  BUILD_NARRATIVES,
  DISTRIBUTE_NARRATIVES,
  EXPLORE_NARRATIVES,
  SPELL_ARM_NARRATIVES,
  SPELL_PRODUCE_NARRATIVES,
} from "./content/narratives";

function pickLine(lines: string[], rng: () => number): string {
  if (lines.length === 0) return "";
  return lines[Math.floor(rng() * lines.length)];
}

function attachArtifact(
  report: TurnReport,
  artifact: ArtifactDefinition | null
): TurnReport {
  if (!artifact) return report;
  return {
    ...report,
    narrative: [...report.narrative, artifact.flavorOnFind],
    artifactFound: {
      definitionId: artifact.id,
      name: artifact.name,
      rarity: artifact.rarity,
      type: artifact.type,
    },
    summary: `${report.summary} — found ${artifact.name}`,
  };
}

/** Appends hero-related side effects (emergence + farm-hero special-unit
 *  summon) to a report. Adds narrative lines and stamps a `heroEmerged`
 *  field on `outcome` so the dashboard's DashboardReports can render a
 *  "✨ {name} the {specialty} {class} hero emerged!" line. */
export interface HeroReportExtras {
  heroEmerged?: GameHero | null;
  specialUnitSummoned?: {
    instanceId: string;
    defId: string;
    name: string;
  } | null;
}

function attachHero(report: TurnReport, extras: HeroReportExtras): TurnReport {
  if (!extras.heroEmerged && !extras.specialUnitSummoned) return report;
  const narrative = [...report.narrative];
  let outcome = { ...report.outcome };
  if (extras.heroEmerged) {
    const h = extras.heroEmerged;
    narrative.push(
      `✨ ${h.name} (${h.specialty} ${h.class} hero) has emerged on ${h.tileId}.`
    );
    outcome = {
      ...outcome,
      heroEmerged: {
        id: h.id,
        name: h.name,
        class: h.class,
        specialty: h.specialty,
        tileId: h.tileId,
      },
    };
  }
  if (extras.specialUnitSummoned) {
    narrative.push(
      `A ${extras.specialUnitSummoned.name} has answered the call.`
    );
    outcome = {
      ...outcome,
      specialUnitSummoned: {
        instanceId: extras.specialUnitSummoned.instanceId,
        defId: extras.specialUnitSummoned.defId,
        name: extras.specialUnitSummoned.name,
      },
    };
  }
  return { ...report, narrative, outcome };
}

// ───────── explore ─────────

export function buildExploreReport(
  turnIndex: number,
  tile: Pick<GameTile, "tileId" | "type">,
  artifactFound: ArtifactDefinition | null,
  rng: () => number
): TurnReport {
  const narrative = [pickLine(EXPLORE_NARRATIVES, rng)];
  const base: TurnReport = {
    turnIndex,
    action: "explore",
    cost: 1,
    summary: `Revealed ${tile.tileId}`,
    narrative,
    outcome: { tileId: tile.tileId, tileType: tile.type },
  };
  return attachArtifact(base, artifactFound);
}

// ───────── build ─────────

export function buildBuildReport(args: {
  turnIndex: number;
  cost: number;
  tileId: string;
  unitType: UnitType;
  unitsBuilt: number;
  artifactFound: ArtifactDefinition | null;
  rng: () => number;
  // Heroes (May 2026). Optional — when present, attaches a narrative line
  // and stamps the outcome with `heroEmerged` / `specialUnitSummoned`.
  heroEmerged?: GameHero | null;
  specialUnitSummoned?: HeroReportExtras["specialUnitSummoned"];
}): TurnReport {
  const narrative = [pickLine(BUILD_NARRATIVES, args.rng)];
  const base: TurnReport = {
    turnIndex: args.turnIndex,
    action: "build",
    cost: args.cost,
    summary: `Built ${args.unitsBuilt} ${args.unitType} on ${args.tileId}`,
    narrative,
    outcome: {
      tileId: args.tileId,
      unitType: args.unitType,
      unitsBuilt: args.unitsBuilt,
    },
  };
  const withArtifact = attachArtifact(base, args.artifactFound);
  return attachHero(withArtifact, {
    heroEmerged: args.heroEmerged ?? null,
    specialUnitSummoned: args.specialUnitSummoned ?? null,
  });
}

// ───────── distribute ─────────

export function buildDistributeReport(args: {
  turnIndex: number;
  tileId: string;
  newType: LandType;
  artifactFound: ArtifactDefinition | null;
  rng: () => number;
}): TurnReport {
  const narrative = [pickLine(DISTRIBUTE_NARRATIVES, args.rng)];
  const base: TurnReport = {
    turnIndex: args.turnIndex,
    action: "distribute",
    cost: 1,
    summary: `${args.tileId} → ${args.newType}`,
    narrative,
    outcome: { tileId: args.tileId, newType: args.newType },
  };
  return attachArtifact(base, args.artifactFound);
}

// ───────── arm defense spell ─────────

export function buildArmDefenseReport(args: {
  turnIndex: number;
  cost: number;
  tileId: string;
  spellId: string;
  spellName: string;
  artifactFound: ArtifactDefinition | null;
  rng: () => number;
  heroEmerged?: GameHero | null;
}): TurnReport {
  const narrative = [pickLine(SPELL_ARM_NARRATIVES, args.rng)];
  const base: TurnReport = {
    turnIndex: args.turnIndex,
    action: "spell-arm",
    cost: args.cost,
    summary: `Armed ${args.spellName} on ${args.tileId}`,
    narrative,
    outcome: {
      tileId: args.tileId,
      spellId: args.spellId,
      spellName: args.spellName,
    },
  };
  const withArtifact = attachArtifact(base, args.artifactFound);
  return attachHero(withArtifact, { heroEmerged: args.heroEmerged ?? null });
}

// ───────── cast production spell ─────────

export function buildProduceReport(args: {
  turnIndex: number;
  cost: number;
  spellId: string;
  spellName: string;
  expiresAtTurn: number;
  artifactFound: ArtifactDefinition | null;
  rng: () => number;
}): TurnReport {
  const narrative = [pickLine(SPELL_PRODUCE_NARRATIVES, args.rng)];
  const base: TurnReport = {
    turnIndex: args.turnIndex,
    action: "spell-produce",
    cost: args.cost,
    summary: `Cast ${args.spellName} (expires turn ${args.expiresAtTurn})`,
    narrative,
    outcome: {
      spellId: args.spellId,
      spellName: args.spellName,
      expiresAtTurn: args.expiresAtTurn,
    },
  };
  return attachArtifact(base, args.artifactFound);
}

// ───────── attack ─────────
//
// Attack narratives are templated rather than picked whole because they need
// to reference real numbers from the combat resolution (units sent, casualties,
// outcome). The builder picks one fragment from each section and stitches them
// together with the structured combat details.

function totalUnits(stack: UnitStack): number {
  return stack.ground + stack.siege + stack.air;
}

function fmtStack(stack: UnitStack): string {
  return `G${stack.ground} S${stack.siege} A${stack.air}`;
}

function pickClosing(outcome: AttackOutcome, rng: () => number): string {
  if (outcome === "captured") return pickLine(ATTACK_CAPTURED_CLOSERS, rng);
  if (outcome === "repelled") return pickLine(ATTACK_REPELLED_CLOSERS, rng);
  return pickLine(ATTACK_STALEMATE_CLOSERS, rng);
}

export function buildAttackReport(args: {
  turnIndex: number;
  cost: number;
  targetTileId: string;
  unitsSent: UnitStack;
  combat: CombatResult;
  artifactFound: ArtifactDefinition | null;
  rng: () => number;
  // Heroes (May 2026). Optional — present when the attack triggered a
  // hero side-effect.
  heroEmerged?: GameHero | null;
  // The chosen action against the defender's hero (when one was present
  // and the attacker won). Null/undefined when no hero was on the tile or
  // combat didn't capture. After convert-failure this reflects the
  // FALLBACK action (kill / spare), so the narrative shows what actually
  // happened.
  heroAction?: "kill" | "spare" | "convert" | null;
  heroDefected?: {
    id: string;
    name: string;
    class: GameHero["class"];
    specialty: GameHero["specialty"];
  } | null;
  heroSlain?: {
    id: string;
    name: string;
    class: GameHero["class"];
    specialty: GameHero["specialty"];
  } | null;
}): TurnReport {
  const opening = pickLine(ATTACK_OPENINGS, args.rng);
  const middle = pickLine(ATTACK_MIDDLES, args.rng);
  const closing = pickClosing(args.combat.outcome, args.rng);

  const line1 = `${opening} ${middle}, ${closing}`;
  const line2 = `Sent ${fmtStack(args.unitsSent)} (${totalUnits(args.unitsSent)} total). Lost ${fmtStack(
    args.combat.attackerLosses
  )}; defenders lost ${fmtStack(args.combat.defenderLosses)}.`;
  const heroLines: string[] = [];
  if (args.heroDefected) {
    heroLines.push(
      `${args.heroDefected.name} (${args.heroDefected.specialty} ${args.heroDefected.class} hero) has defected to your kingdom.`
    );
  } else if (args.heroSlain) {
    heroLines.push(
      `${args.heroSlain.name} (${args.heroSlain.specialty} ${args.heroSlain.class} hero) fell with the tile.`
    );
  } else if (args.heroAction === "spare") {
    heroLines.push(
      "The hero on the tile was spared. The line did not break."
    );
  }

  let summary: string;
  if (args.heroAction === "spare") {
    summary = `Wore down hero at ${args.targetTileId}`;
  } else if (args.heroDefected) {
    summary = `Hero defected at ${args.targetTileId}`;
  } else if (args.combat.outcome === "captured") {
    summary = `Captured ${args.targetTileId}`;
  } else if (args.combat.outcome === "repelled") {
    summary = `Repelled at ${args.targetTileId}`;
  } else {
    summary = `Stalemate at ${args.targetTileId}`;
  }

  const base: TurnReport = {
    turnIndex: args.turnIndex,
    action: "attack",
    cost: args.cost,
    summary,
    narrative: [line1, line2, ...heroLines],
    outcome: {
      targetTileId: args.targetTileId,
      result: args.combat.outcome,
      unitsSent: args.unitsSent,
      attackerLosses: args.combat.attackerLosses,
      defenderLosses: args.combat.defenderLosses,
      attackPower: args.combat.attackPower,
      defensePower: args.combat.defensePower,
      underdogApplied: args.combat.underdogApplied,
      // Tile-type modifiers (May 2026 mechanics rework). Surfaced so the
      // battle readout on /game/threats can show "Military source ×1.20",
      // "Magic tile floor +X", etc.
      sourceLandTypeMultiplier: args.combat.sourceLandTypeMultiplier,
      targetLandTypeMultiplier: args.combat.targetLandTypeMultiplier,
      standingDefenseAdded: args.combat.standingDefenseAdded,
      magicTileOffenseSpellBonusApplied:
        args.combat.magicTileOffenseSpellBonusApplied,
      magicTileDefenseSpellBonusApplied:
        args.combat.magicTileDefenseSpellBonusApplied,
      siegeDebuffApplied: args.combat.siegeDebuffApplied,
      defenseDisarmApplied: args.combat.defenseDisarmApplied,
      preCastOffenseApplied: args.combat.preCastOffenseApplied,
      // Hero side-effects (when applicable).
      ...(args.heroAction ? { heroAction: args.heroAction } : {}),
      ...(args.heroDefected ? { heroDefected: args.heroDefected } : {}),
      ...(args.heroSlain ? { heroSlain: args.heroSlain } : {}),
    },
  };
  const withArtifact = attachArtifact(base, args.artifactFound);
  return attachHero(withArtifact, { heroEmerged: args.heroEmerged ?? null });
}

// ───────── siege ─────────
//
// Siege is a deterministic infrastructure-degrading move (no dice). Each
// cast deposits SIEGE_ACTION_MAGNITUDE on the target's standing-defense
// floor and stacks up to SIEGE_DEBUFF_MAX_MAGNITUDE. The narrative is
// short — players are about to read it many times across a campaign.
const SIEGE_NARRATIVES = [
  "Trenches inch forward. The walls answer with arrows; the dirt answers with patience.",
  "Sappers tunnel through the night. By dawn, a fault line in the rampart.",
  "Your engineers measure, mark, and break. The garrison hears the work and counts.",
  "A siege tower rolls into range. The defenders feed it bolts; you feed it more wood.",
  "Catapults find their cadence. Stone after stone tests where the wall is weakest.",
];

export function buildSiegeReport(args: {
  turnIndex: number;
  cost: number;
  targetTileId: string;
  magnitudeApplied: number;
  totalMagnitudeAfter: number;
  rng: () => number;
}): TurnReport {
  const summary = `Siege at ${args.targetTileId} · −${(args.magnitudeApplied * 100).toFixed(0)}% standing floor`;
  return {
    turnIndex: args.turnIndex,
    action: "siege",
    cost: args.cost,
    summary,
    narrative: [pickLine(SIEGE_NARRATIVES, args.rng)],
    outcome: {
      targetTileId: args.targetTileId,
      magnitudeApplied: args.magnitudeApplied,
      totalMagnitudeAfter: args.totalMagnitudeAfter,
    },
  };
}

// ───────── cast spell (siege / disarm / attrition) ─────────
//
// Standalone spell-cast report. The kind-specific outcome is encoded in
// `outcome.kind` and a payload field; the narrative line picks from a
// shared bank flavored by kind.

const CAST_SIEGE_NARRATIVES = [
  "The casting holds for a long heartbeat. The wall remembers being a quarry, briefly, and a section gives.",
  "A magical pressure plays across the rampart. Not a spell that breaks; a spell that tires.",
  "The siegework is finished by spellcraft what hands could not finish in a week.",
];
const CAST_DISARM_NARRATIVES = [
  "The defender's wards flicker. A few hold; most don't.",
  "Glyphs unwind themselves, one careful loop at a time, as if confused by their own purpose.",
  "Whatever the defender hung on the gate stops being there.",
];
const CAST_ATTRITION_NARRATIVES = [
  "The garrison thins by a count it will not write down.",
  "A bad night for the defender's roll-call. By dawn, gaps in the line.",
  "The spell does not announce itself. The casualties are quiet about it too.",
];

export function buildCastSpellReport(args: {
  turnIndex: number;
  cost: number;
  spellId: string;
  spellName: string;
  spellType: "siege" | "disarm" | "attrition";
  targetTileId: string;
  // Kind-specific payload. Exactly one of these is populated, matching
  // `spellType`.
  siege?: { magnitudeApplied: number; totalMagnitudeAfter: number };
  disarm?: { fractionApplied: number };
  attrition?: { unitsKilled: UnitStack };
  rng: () => number;
  heroEmerged?: GameHero | null;
}): TurnReport {
  let summary: string;
  let narrativeBank: string[];
  if (args.spellType === "siege") {
    const m = args.siege?.magnitudeApplied ?? 0;
    summary = `${args.spellName} on ${args.targetTileId} · −${(m * 100).toFixed(0)}% standing floor`;
    narrativeBank = CAST_SIEGE_NARRATIVES;
  } else if (args.spellType === "disarm") {
    const f = args.disarm?.fractionApplied ?? 0;
    summary = `${args.spellName} on ${args.targetTileId} · ${(f * 100).toFixed(0)}% disarm queued`;
    narrativeBank = CAST_DISARM_NARRATIVES;
  } else {
    const k = args.attrition?.unitsKilled;
    const total = k ? k.ground + k.siege + k.air : 0;
    summary = `${args.spellName} on ${args.targetTileId} · ${total} defenders lost`;
    narrativeBank = CAST_ATTRITION_NARRATIVES;
  }
  const base: TurnReport = {
    turnIndex: args.turnIndex,
    action: "spell-cast",
    cost: args.cost,
    summary,
    narrative: [pickLine(narrativeBank, args.rng)],
    outcome: {
      spellId: args.spellId,
      spellName: args.spellName,
      spellType: args.spellType,
      targetTileId: args.targetTileId,
      ...(args.siege ? { siege: args.siege } : {}),
      ...(args.disarm ? { disarm: args.disarm } : {}),
      ...(args.attrition ? { attrition: args.attrition } : {}),
    },
  };
  return attachHero(base, { heroEmerged: args.heroEmerged ?? null });
}

// ───────── flyover ─────────
//
// Air-only raid that attrits defenders without taking the tile. Always
// resolves to "repelled" (or "stalemate"). Attacker losses are doubled —
// flagged here in the report copy so players see the trade. The combat
// payload is the post-processed CombatResult.
const FLYOVER_NARRATIVES = [
  "Air units strafe the tile and pull up before the spears reach. They leave smoke and arithmetic behind.",
  "Wings overhead. Bolts up; bodies down. The raid pulls clear before the gates open.",
  "A flyover, sharp and brief. The defenders learn that the sky is not theirs.",
  "Your air column harasses the tile and breaks off — a bruise, not a wound.",
];

export function buildFlyoverReport(args: {
  turnIndex: number;
  cost: number;
  targetTileId: string;
  unitsSent: UnitStack;
  combat: CombatResult;
  artifactFound: ArtifactDefinition | null;
  rng: () => number;
}): TurnReport {
  const summary = `Flyover at ${args.targetTileId}`;
  const line1 = pickLine(FLYOVER_NARRATIVES, args.rng);
  const line2 = `Sent ${fmtStack(args.unitsSent)} air. Lost ${fmtStack(args.combat.attackerLosses)} (2× penalty); defenders lost ${fmtStack(args.combat.defenderLosses)}.`;
  const base: TurnReport = {
    turnIndex: args.turnIndex,
    action: "flyover",
    cost: args.cost,
    summary,
    narrative: [line1, line2],
    outcome: {
      targetTileId: args.targetTileId,
      result: args.combat.outcome,
      unitsSent: args.unitsSent,
      attackerLosses: args.combat.attackerLosses,
      defenderLosses: args.combat.defenderLosses,
      attackPower: args.combat.attackPower,
      defensePower: args.combat.defensePower,
    },
  };
  return attachArtifact(base, args.artifactFound);
}
