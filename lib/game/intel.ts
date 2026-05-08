/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Firestore } from "firebase-admin/firestore";
import { computeSupplyMultiplier } from "./combat";
import type {
  Caste,
  GamePlayer,
  GameTile,
  IntelDepth,
  IntelReport,
  LandType,
  UnitStack,
  UnitType,
} from "./types";
import { neighborTileIds } from "./world-gen";

const TILES = "game_tiles";
const PLAYERS = "game_players";
const ARTIFACTS = "game_artifacts";

const UNIT_TYPES: readonly UnitType[] = ["ground", "siege", "air"] as const;
// Defender's heaviest unit type → attacker's best counter (the type that
// beats it under air→ground→siege→air).
const RPS_COUNTERS: Record<UnitType, UnitType> = {
  ground: "air",
  siege: "ground",
  air: "siege",
};

export type IntelScope =
  | IntelDepth
  | "kingdom+supply"
  | "weak-face";

/**
 * Read a snapshot of intel about a target tile. Reads run outside any
 * transaction — the caller is expected to have already committed any
 * source-of-intel side effects (artifact "used" flag, spell "cast" flag) so
 * staleness here is acceptable. The intel is a point-in-time read of public
 * server state.
 */
export async function buildIntelReportServer(args: {
  db: Firestore;
  targetTileId: string;
  scope: IntelScope;
  source: "artifact" | "spell" | "passive";
  sourceId: string;
  capturedAtTurn: number;
  attackerCaste?: Caste;
}): Promise<IntelReport> {
  const { db, targetTileId, scope, source, sourceId, capturedAtTurn } = args;

  const targetSnap = await db.collection(TILES).doc(targetTileId).get();
  if (!targetSnap.exists) {
    throw new Error(`Intel target tile not found: ${targetTileId}`);
  }
  const target = targetSnap.data() as GameTile;

  const report: IntelReport = {
    targetTileId,
    targetOwnerId: target.ownerId,
    capturedAtTurn,
    source,
    sourceId,
    scope,
    target: {
      landType: target.type,
      units: target.units,
      armedDefenseSpellId: target.armedDefenseSpellId,
      isolatedSpawn: target.isolatedSpawn ?? false,
    },
  };

  const wantsRing =
    scope === "ring" ||
    scope === "kingdom" ||
    scope === "kingdom+supply";

  if (wantsRing) {
    const nbrIds = neighborTileIds(target.q, target.r);
    const refs = nbrIds.map((id) => db.collection(TILES).doc(id));
    const snaps = await db.getAll(...refs);
    const neighbors: NonNullable<IntelReport["neighbors"]> = [];
    for (let i = 0; i < snaps.length; i++) {
      const s = snaps[i];
      if (!s.exists) continue;
      const t = s.data() as GameTile;
      neighbors.push({
        tileId: nbrIds[i],
        ownerId: t.ownerId,
        landType: t.type,
        units: t.units,
      });
    }
    report.neighbors = neighbors;

    if (scope === "kingdom+supply") {
      const friendly: Array<{ landType: LandType }> = [];
      const friendlyIds: Array<{ tileId: string; landType: LandType }> = [];
      for (const n of neighbors) {
        if (n.ownerId !== target.ownerId) continue;
        if (n.landType === "unrevealed" || n.landType === "unassigned") continue;
        friendly.push({ landType: n.landType });
        friendlyIds.push({ tileId: n.tileId, landType: n.landType });
      }
      // Look up defender caste so the supply multiplier reflects who's playing
      // the tile, not the spy. Falls back to a neutral 1.0 if owner missing.
      let defenderCaste: Caste | null = null;
      if (target.ownerId) {
        const defSnap = await db.collection(PLAYERS).doc(target.ownerId).get();
        if (defSnap.exists) {
          defenderCaste = (defSnap.data() as GamePlayer).caste;
        }
      }
      const supplyMult = defenderCaste
        ? computeSupplyMultiplier(defenderCaste, friendly)
        : 1;
      report.supply = {
        friendlyNeighbors: friendlyIds,
        supplyMultiplier: supplyMult,
      };
    }
  }

  const wantsKingdom = scope === "kingdom" || scope === "kingdom+supply";
  if (wantsKingdom && target.ownerId) {
    const defSnap = await db.collection(PLAYERS).doc(target.ownerId).get();
    if (defSnap.exists) {
      const def = defSnap.data() as GamePlayer;
      const artifactSnap = await db
        .collection(ARTIFACTS)
        .where("ownerId", "==", target.ownerId)
        .where("used", "==", false)
        .get();
      report.kingdomDefender = {
        tilesHeld: def.stats.tilesHeld,
        unitsAlive: def.stats.unitsAlive,
        activeProductionSpellIds: (def.productionSpellsActive ?? []).map(
          (s) => s.spellId
        ),
        artifactCount: artifactSnap.size,
      };
    }
  }

  if (scope === "weak-face") {
    report.weakFace = pickWeakFace(target.units);
  }

  return report;
}

function pickWeakFace(units: UnitStack): UnitType | undefined {
  let max = 0;
  let dominant: UnitType | undefined;
  for (const t of UNIT_TYPES) {
    if (units[t] > max) {
      max = units[t];
      dominant = t;
    }
  }
  if (!dominant) return undefined;
  return RPS_COUNTERS[dominant];
}
