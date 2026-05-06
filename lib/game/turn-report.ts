/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { ArtifactDefinition, GameTile, TurnReport } from "./types";
import { EXPLORE_NARRATIVES } from "./content/narratives";

function pickLine(lines: string[], rng: () => number): string {
  if (lines.length === 0) return "";
  return lines[Math.floor(rng() * lines.length)];
}

/**
 * Build a one-action TurnReport for an explore turn.
 *
 * @param turnIndex      player.turnsSpentTotal AFTER this turn (i.e. the
 *                       1-indexed turn number this report represents).
 * @param tile           the tile that was just revealed/claimed.
 * @param artifactFound  null if the artifact roll did not hit, otherwise the
 *                       definition of the artifact that was found.
 * @param rng            seeded PRNG for narrative selection. Should be
 *                       distinct from the artifact-roll RNG so the same line
 *                       isn't always paired with the same drop.
 */
export function buildExploreReport(
  turnIndex: number,
  tile: Pick<GameTile, "tileId" | "type">,
  artifactFound: ArtifactDefinition | null,
  rng: () => number
): TurnReport {
  const narrativeLine = pickLine(EXPLORE_NARRATIVES, rng);

  const narrative: string[] = [narrativeLine];
  if (artifactFound) {
    narrative.push(artifactFound.flavorOnFind);
  }

  const summary = artifactFound
    ? `Revealed ${tile.tileId} — found ${artifactFound.name}`
    : `Revealed ${tile.tileId}`;

  const report: TurnReport = {
    turnIndex,
    action: "explore",
    cost: 1,
    summary,
    narrative,
    outcome: {
      tileId: tile.tileId,
      tileType: tile.type,
    },
  };

  if (artifactFound) {
    report.artifactFound = {
      definitionId: artifactFound.id,
      name: artifactFound.name,
      rarity: artifactFound.rarity,
      type: artifactFound.type,
    };
  }

  return report;
}
