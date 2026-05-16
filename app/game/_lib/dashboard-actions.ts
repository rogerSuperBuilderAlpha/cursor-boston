/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import type { User } from "firebase/auth";
import type {
  CombatResult,
  GameArtifact,
  GamePlayer,
  GameTile,
  GameWorldMeta,
  IntelReport,
  LandType,
  MapTile,
  TurnReport,
  UnitStack,
  UnitType,
} from "@/lib/game/types";
import type { ActionProgress } from "./dashboard-types";

/**
 * Mutators the action handlers reach back into. Bundled into one bag so
 * `useDashboardData()` can hand them to action factories without each
 * one needing 6+ closure params.
 */
export interface DashboardMutators {
  setError: (msg: string | null) => void;
  setPlayer: (p: GamePlayer | null) => void;
  setRecentReports: (
    update: (prev: TurnReport[]) => TurnReport[]
  ) => void;
  mergeOwnedTiles: (updates: MapTile[]) => void;
  /** Update enemy/border tiles in the dashboard's worldTiles state and the
   *  localStorage map cache. Used by Far Expedition and Attack to surface
   *  newly-adjacent enemy tiles in the threat box without a page reload. */
  mergeBorderTiles: (updates: MapTile[]) => void;
  /** Patch the artifacts inventory after a use / find. Pass artifact docs
   *  with `used` flipped or freshly-found artifacts. */
  mergeArtifacts: (updates: GameArtifact[]) => void;
  /** Patch the dashboard's worldMeta snapshot (seal count, season number,
   *  armageddon state). Used by the Armageddon cast handler. */
  setWorldMeta?: (m: GameWorldMeta | null) => void;
}

/**
 * Convert the GameTile shape returned by single-tile action endpoints
 * (build / arm / distribute / attack) into the lighter MapTile shape that
 * lives in the dashboard's tiles + worldTiles state.
 */
function asMapTile(t: GameTile): MapTile {
  return {
    tileId: t.tileId,
    q: t.q,
    r: t.r,
    type: t.type,
    ownerId: t.ownerId ?? null,
    units: t.units,
    armedDefenseSpellId: t.armedDefenseSpellId ?? null,
  };
}

/** Common error-message extraction for `data.error` (string | object). */
function asErrorMessage(data: { error?: unknown }, fallback: string): string {
  if (typeof data.error === "string") return data.error;
  const e = data.error as { message?: string } | undefined;
  return e?.message ?? fallback;
}


/**
 * POST /api/game/player — spawn the user's first general. Refetches on
 * success because we want the caller to re-mount with `player !== null`.
 */
export async function createPlayer(
  user: User,
  displayName: string,
  mut: { setError: DashboardMutators["setError"] },
  refetch: () => Promise<void>
): Promise<void> {
  mut.setError(null);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/player", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Failed to create player"));
    }
    await refetch();
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Failed to create player");
  }
}

/**
 * PATCH /api/game/player — rename the general. Patches local state from
 * the response instead of refetching since nothing else changes.
 */
export async function setPlayerName(
  user: User,
  displayName: string,
  mut: Pick<DashboardMutators, "setError" | "setPlayer">
): Promise<void> {
  mut.setError(null);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/player", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Failed to save name"));
    }
    if (data.player) mut.setPlayer(data.player as GamePlayer);
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Failed to save name");
  }
}

/**
 * POST /api/game/explore/bulk — claim N adjacent unrevealed tiles in
 * one transaction. Caps at 50 per call (server enforces too).
 */
export async function frontierExplore(
  user: User,
  count: number,
  mut: DashboardMutators,
  setProgress: (p: ActionProgress | null) => void
): Promise<void> {
  const total = Math.max(1, Math.min(50, Math.floor(count)));
  mut.setError(null);
  setProgress({ done: 0, total, artifactsFound: 0 });
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/explore/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ count: total }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Explore failed"));
    }
    consumeReports(data, mut, setProgress, total, "Claimed");
    if (data.player) mut.setPlayer(data.player as GamePlayer);
    if (Array.isArray(data.tiles))
      mut.mergeOwnedTiles(data.tiles as MapTile[]);
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Explore failed");
  } finally {
    setProgress(null);
  }
}

/**
 * POST /api/game/distribute/bulk — re-assign the type of N tiles
 * matched by `sourceFilter` to `targetType`. Used for both
 * "assign unassigned → military/food/magic" and
 * "revert military → unassigned" via the same endpoint.
 */
export async function bulkDistribute(
  user: User,
  args: {
    targetType: LandType;
    count: number;
    sourceFilter: (t: MapTile) => boolean;
    sourceLabel: string;
    tiles: MapTile[];
  },
  mut: DashboardMutators,
  setProgress: (p: ActionProgress | null) => void
): Promise<void> {
  const sources = args.tiles.filter(args.sourceFilter).map((t) => t.tileId);
  const total = Math.min(sources.length, Math.max(1, Math.floor(args.count)));
  if (total === 0) {
    mut.setError(`No ${args.sourceLabel} tiles to distribute.`);
    return;
  }
  mut.setError(null);
  setProgress({ done: 0, total, artifactsFound: 0 });
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/distribute/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tileIds: sources.slice(0, total),
        type: args.targetType,
      }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Distribute failed"));
    }
    consumeReports(data, mut, setProgress, total, "Stopped early after");
    if (data.player) mut.setPlayer(data.player as GamePlayer);
    if (Array.isArray(data.tiles))
      mut.mergeOwnedTiles(data.tiles as MapTile[]);
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Distribute failed");
  } finally {
    setProgress(null);
  }
}

/**
 * POST /api/game/explore/far — spend 2 turns to plant a tile next to a
 * random enemy. Patches local state from the response so the threat box
 * + supply UI reflect the new bordering general without a reload.
 */
export async function farExpedition(
  user: User,
  mut: DashboardMutators
): Promise<{ tileId: string; enemyTileId: string } | null> {
  mut.setError(null);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/explore/far", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Far Expedition failed"));
    }
    if (data.player) mut.setPlayer(data.player as GamePlayer);
    if (data.tile) mut.mergeOwnedTiles([data.tile as MapTile]);
    // Order matters: the cache's border-tile router checks "does this tile
    // touch one of mine?" against the snapshot of myTiles taken before the
    // current merge. Adding the new owned tile first lets the enemy tile
    // be recognized as a border tile in the second call.
    if (data.enemyTile) mut.mergeBorderTiles([data.enemyTile as MapTile]);
    if (data.report) {
      mut.setRecentReports((prev) =>
        [data.report as TurnReport, ...prev].slice(0, 50)
      );
    }
    return {
      tileId: (data.tile as MapTile | undefined)?.tileId ?? "",
      enemyTileId: (data.targetEnemyTileId as string | undefined) ?? "",
    };
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Far Expedition failed");
    return null;
  }
}

/**
 * POST /api/game/spy — cast the player's caste intel spell on a target
 * enemy tile. Returns the IntelReport for inline display.
 */
export async function castIntelSpell(
  user: User,
  spellId: string,
  targetTileId: string,
  mut: DashboardMutators
): Promise<{ intelReport: unknown; detected: boolean } | null> {
  mut.setError(null);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/spy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ spellId, targetTileId }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Spy spell failed"));
    }
    if (data.player) mut.setPlayer(data.player as GamePlayer);
    if (data.report) {
      mut.setRecentReports((prev) =>
        [data.report as TurnReport, ...prev].slice(0, 50)
      );
    }
    return {
      intelReport: data.intelReport,
      detected: Boolean(data.detected),
    };
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Spy spell failed");
    return null;
  }
}

/**
 * POST /api/game/attack — single-tile attack with optional offense spell.
 * Patches both source (mine) and target (border) tiles + the attacker's
 * player record from the response. Returns the IntelReport if a Blue/Black
 * air-intel passive fired.
 */
export async function attack(
  user: User,
  args: {
    sourceTileId: string;
    targetTileId: string;
    units: UnitStack;
    offenseSpellId: string | null;
  },
  mut: DashboardMutators
): Promise<{
  outcome: string;
  reportSummary: string;
  intelReport: IntelReport | null;
  combat: CombatResult | null;
  report: TurnReport | null;
  /** Post-combat enemy tile state — used by BattleReport to derive
   *  defender pre-attack units = `targetTile.units + combat.defenderLosses`. */
  targetTile: GameTile | null;
} | null> {
  mut.setError(null);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/attack", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(args),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Attack failed"));
    }
    // Attack response uses `attackerPlayer` instead of the standard `player`.
    if (data.attackerPlayer) mut.setPlayer(data.attackerPlayer as GamePlayer);
    if (data.sourceTile) mut.mergeOwnedTiles([asMapTile(data.sourceTile as GameTile)]);
    if (data.targetTile) {
      const tt = data.targetTile as GameTile;
      // If we captured the tile, it now belongs to us — funnel through
      // mergeOwnedTiles. Otherwise it stays in the enemy ring.
      if (tt.ownerId === user.uid) {
        mut.mergeOwnedTiles([asMapTile(tt)]);
      } else {
        mut.mergeBorderTiles([asMapTile(tt)]);
      }
    }
    if (data.report) {
      mut.setRecentReports((prev) =>
        [data.report as TurnReport, ...prev].slice(0, 50)
      );
    }
    return {
      outcome: (data.attack as { outcome?: string } | undefined)?.outcome ?? "",
      reportSummary:
        (data.report as { summary?: string } | undefined)?.summary ?? "",
      intelReport: (data.intelReport as IntelReport | undefined) ?? null,
      combat: (data.combat as CombatResult | undefined) ?? null,
      report: (data.report as TurnReport | undefined) ?? null,
      targetTile: (data.targetTile as GameTile | undefined) ?? null,
    };
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Attack failed");
    return null;
  }
}

/** POST /api/game/build — recruit one batch (`+10` units of one type). */
export async function recruitUnits(
  user: User,
  tileId: string,
  unitType: UnitType,
  mut: DashboardMutators
): Promise<{ produced: number; reportSummary: string } | null> {
  mut.setError(null);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/build", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tileId, unitType }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Recruit failed"));
    }
    if (data.player) mut.setPlayer(data.player as GamePlayer);
    if (data.tile) mut.mergeOwnedTiles([asMapTile(data.tile as GameTile)]);
    if (data.report) {
      mut.setRecentReports((prev) =>
        [data.report as TurnReport, ...prev].slice(0, 50)
      );
    }
    return {
      produced: typeof data.produced === "number" ? data.produced : 0,
      reportSummary:
        (data.report as { summary?: string } | undefined)?.summary ?? "",
    };
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Recruit failed");
    return null;
  }
}

/** POST /api/game/spell/arm — pre-arm one defense spell on one tile. */
export async function armDefenseSpell(
  user: User,
  tileId: string,
  spellId: string,
  mut: DashboardMutators
): Promise<{ reportSummary: string } | null> {
  mut.setError(null);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/spell/arm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tileId, spellId }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Arm spell failed"));
    }
    if (data.player) mut.setPlayer(data.player as GamePlayer);
    if (data.tile) mut.mergeOwnedTiles([asMapTile(data.tile as GameTile)]);
    if (data.report) {
      mut.setRecentReports((prev) =>
        [data.report as TurnReport, ...prev].slice(0, 50)
      );
    }
    return {
      reportSummary:
        (data.report as { summary?: string } | undefined)?.summary ?? "",
    };
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Arm spell failed");
    return null;
  }
}

/**
 * POST /api/game/setup/distribute — change one owned tile's land type
 * (military / food / magic / unassigned). The "setup" route name is a v1
 * artifact; the underlying server function permits the play phase too.
 */
export async function distributeTile(
  user: User,
  tileId: string,
  type: LandType,
  mut: DashboardMutators
): Promise<{ reportSummary: string } | null> {
  mut.setError(null);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/setup/distribute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tileId, type, count: 1 }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Distribute failed"));
    }
    if (data.player) mut.setPlayer(data.player as GamePlayer);
    if (data.tile) mut.mergeOwnedTiles([asMapTile(data.tile as GameTile)]);
    if (data.report) {
      mut.setRecentReports((prev) =>
        [data.report as TurnReport, ...prev].slice(0, 50)
      );
    }
    return {
      reportSummary:
        (data.report as { summary?: string } | undefined)?.summary ?? "",
    };
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Distribute failed");
    return null;
  }
}

/**
 * POST /api/game/artifact/use — spend a single artifact, optionally on a
 * target tile. Intel artifacts return an IntelReport that the caller is
 * expected to render (e.g. ThreatRow inline panel).
 *
 * Named `spendArtifact` (not `useArtifact`) to avoid React's
 * `react-hooks/rules-of-hooks` lint flagging it inside `useCallback`.
 */
export async function spendArtifact(
  user: User,
  artifactId: string,
  targetTileId: string | null,
  mut: DashboardMutators
): Promise<{ intelReport: IntelReport | null } | null> {
  mut.setError(null);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/artifact/use", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        artifactId,
        ...(targetTileId ? { targetTileId } : {}),
      }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Artifact use failed"));
    }
    if (data.artifact) mut.mergeArtifacts([data.artifact as GameArtifact]);
    return {
      intelReport: (data.intelReport as IntelReport | undefined) ?? null,
    };
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Artifact use failed");
    return null;
  }
}

/**
 * POST /api/game/siege — soften a target tile's standing-defense floor.
 * 5-turn cost, stacking up to SIEGE_DEBUFF_MAX_MAGNITUDE.
 */
export async function siege(
  user: User,
  args: { sourceTileId: string; targetTileId: string },
  mut: DashboardMutators
): Promise<{
  reportSummary: string;
  siegeTotalMagnitude: number;
} | null> {
  mut.setError(null);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/siege", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(args),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Siege failed"));
    }
    if (data.player) mut.setPlayer(data.player as GamePlayer);
    if (data.report) {
      mut.setRecentReports((prev) =>
        [data.report as TurnReport, ...prev].slice(0, 50)
      );
    }
    return {
      reportSummary:
        (data.report as { summary?: string } | undefined)?.summary ?? "Siege",
      siegeTotalMagnitude:
        typeof data.siegeTotalMagnitude === "number"
          ? data.siegeTotalMagnitude
          : 0,
    };
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Siege failed");
    return null;
  }
}

/**
 * POST /api/game/flyover — air-only raid that attrits defenders without
 * taking the tile. Always resolves to "repelled" / "stalemate"; attacker
 * losses are doubled.
 */
export async function flyover(
  user: User,
  args: {
    sourceTileId: string;
    targetTileId: string;
    units: UnitStack;
  },
  mut: DashboardMutators
): Promise<{
  reportSummary: string;
  combat: CombatResult | null;
  report: TurnReport | null;
  targetTile: GameTile | null;
} | null> {
  mut.setError(null);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/flyover", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(args),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Flyover failed"));
    }
    if (data.attackerPlayer) mut.setPlayer(data.attackerPlayer as GamePlayer);
    if (data.sourceTile) {
      mut.mergeOwnedTiles([asMapTile(data.sourceTile as GameTile)]);
    }
    if (data.targetTile) {
      mut.mergeBorderTiles([asMapTile(data.targetTile as GameTile)]);
    }
    if (data.report) {
      mut.setRecentReports((prev) =>
        [data.report as TurnReport, ...prev].slice(0, 50)
      );
    }
    return {
      reportSummary:
        (data.report as { summary?: string } | undefined)?.summary ?? "Flyover",
      combat: (data.combat as CombatResult | undefined) ?? null,
      report: (data.report as TurnReport | undefined) ?? null,
      targetTile: (data.targetTile as GameTile | undefined) ?? null,
    };
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Flyover failed");
    return null;
  }
}

/**
 * POST /api/game/spell/cast — cast a standalone siege/disarm/attrition
 * spell. Server rolls dice; the response carries the kind-specific outcome.
 */
export async function castSpell(
  user: User,
  args: {
    spellId: string;
    sourceTileId: string;
    targetTileId: string;
  },
  mut: DashboardMutators
): Promise<{
  reportSummary: string;
  siege?: { magnitudeApplied: number; totalMagnitudeAfter: number };
  disarm?: { fractionApplied: number };
  attrition?: { unitsKilled: UnitStack };
} | null> {
  mut.setError(null);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/spell/cast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(args),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Spell cast failed"));
    }
    if (data.player) mut.setPlayer(data.player as GamePlayer);
    if (data.report) {
      mut.setRecentReports((prev) =>
        [data.report as TurnReport, ...prev].slice(0, 50)
      );
    }
    // Attrition mutates the target tile; merge into the border-tile cache
    // so the threat row reflects the new defender unit count without a
    // page reload.
    if (data.attrition?.targetTile) {
      mut.mergeBorderTiles([
        asMapTile(data.attrition.targetTile as GameTile),
      ]);
    }
    return {
      reportSummary:
        (data.report as { summary?: string } | undefined)?.summary ??
        "Spell cast",
      ...(data.siege ? { siege: data.siege } : {}),
      ...(data.disarm ? { disarm: data.disarm } : {}),
      ...(data.attrition
        ? {
            attrition: {
              unitsKilled: data.attrition.unitsKilled as UnitStack,
            },
          }
        : {}),
    };
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Spell cast failed");
    return null;
  }
}

/**
 * POST /api/game/spell/armageddon — fire the end-game Armageddon spell.
 * No body. Costs 100 turns regardless of outcome. Returns:
 *   - success: was a seal broken?
 *   - successChance: the probability rolled against (for display)
 *   - sealsBroken: global count after this cast (0..7)
 *   - shouldTriggerResolve: true when this cast broke seal #7
 */
export async function castArmageddon(
  user: User,
  mut: DashboardMutators
): Promise<{
  sealBroken: boolean;
  successChance: number;
  sealsBroken: number;
  seasonNumber: number;
  shouldTriggerResolve: boolean;
} | null> {
  mut.setError(null);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/spell/armageddon", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Armageddon cast failed"));
    }
    if (data.player) mut.setPlayer(data.player as GamePlayer);
    // Patch the local worldMeta snapshot if the dashboard hook wired it.
    // The full seal-attribution detail arrives on the next world-meta
    // refetch (called from the dashboard hook after this resolves).
    if (mut.setWorldMeta) {
      mut.setWorldMeta({
        playerCount: 0, // unknown here; overwritten on next refetch
        seasonNumber: data.seasonNumber as number,
        sealsBroken: data.sealsBroken as number,
        seals: [],
        armageddonState: data.shouldTriggerResolve ? "resolving" : "active",
      });
    }
    return {
      sealBroken: Boolean(data.sealBroken),
      successChance: Number(data.successChance ?? 0),
      sealsBroken: Number(data.sealsBroken ?? 0),
      seasonNumber: Number(data.seasonNumber ?? 1),
      shouldTriggerResolve: Boolean(data.shouldTriggerResolve),
    };
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Armageddon cast failed");
    return null;
  }
}

/** POST /api/game/admin/grant — admin-only manual 100-turn override. */
export async function adminGrant(
  user: User,
  mut: Pick<DashboardMutators, "setError" | "setPlayer">
): Promise<void> {
  mut.setError(null);
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/game/admin/grant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(asErrorMessage(data, "Grant failed"));
    }
    if (data.player) mut.setPlayer(data.player as GamePlayer);
  } catch (e) {
    mut.setError(e instanceof Error ? e.message : "Grant failed");
  }
}

/**
 * Pull TurnReports off a bulk-action response, push them onto the
 * recent-reports stack, and update the per-action progress counter.
 * Shared between `frontierExplore` and `bulkDistribute`.
 */
function consumeReports(
  data: { reports?: unknown; stoppedEarly?: unknown },
  mut: DashboardMutators,
  setProgress: (p: ActionProgress | null) => void,
  total: number,
  stoppedPrefix: string
): void {
  const reports: TurnReport[] = Array.isArray(data.reports)
    ? (data.reports as TurnReport[])
    : [];
  let artifactsFound = 0;
  for (const r of reports) if (r.artifactFound) artifactsFound++;
  if (reports.length > 0) {
    mut.setRecentReports((prev) =>
      [...reports.slice().reverse(), ...prev].slice(0, 50)
    );
  }
  setProgress({ done: reports.length, total, artifactsFound });
  if (data.stoppedEarly) {
    mut.setError(
      `${stoppedPrefix} ${reports.length} / ${total}: ${String(
        data.stoppedEarly
      )}`
    );
  }
}
