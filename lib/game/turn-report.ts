/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type {
  ArtifactDefinition,
  AttackOutcome,
  CombatResult,
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
  return attachArtifact(base, args.artifactFound);
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
  return attachArtifact(base, args.artifactFound);
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
}): TurnReport {
  const opening = pickLine(ATTACK_OPENINGS, args.rng);
  const middle = pickLine(ATTACK_MIDDLES, args.rng);
  const closing = pickClosing(args.combat.outcome, args.rng);

  const line1 = `${opening} ${middle}, ${closing}`;
  const line2 = `Sent ${fmtStack(args.unitsSent)} (${totalUnits(args.unitsSent)} total). Lost ${fmtStack(
    args.combat.attackerLosses
  )}; defenders lost ${fmtStack(args.combat.defenderLosses)}.`;

  let summary: string;
  if (args.combat.outcome === "captured") {
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
    narrative: [line1, line2],
    outcome: {
      targetTileId: args.targetTileId,
      result: args.combat.outcome,
      unitsSent: args.unitsSent,
      attackerLosses: args.combat.attackerLosses,
      defenderLosses: args.combat.defenderLosses,
      attackPower: args.combat.attackPower,
      defensePower: args.combat.defensePower,
      underdogApplied: args.combat.underdogApplied,
    },
  };
  return attachArtifact(base, args.artifactFound);
}
