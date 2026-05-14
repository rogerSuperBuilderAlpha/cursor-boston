/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// Weekly NPC turn-spender. Runs once per week (Sunday 05:30 UTC) after the
// rollover cron. Per NPC (any player doc with `isNpc == true`):
//   1. Apply weekly grant (turnsRemaining = 100), idempotent per week-start.
//   2. Pick a persona deterministically from the uid.
//   3. Spend ~all 100 turns across:
//        - tier-1 production spell casts (5 turns)
//        - bulk unit builds up to food cap (5 turns / 10 units)
//        - up to 15 attacks vs adjacent OTHER NPC tiles (1 turn each;
//          humans are never targeted)
//
// Re-running the same week is a no-op for NPCs already granted that week.

import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import {
  attackTileServer,
  bulkBuildUnitsServer,
  castProductionSpellServer,
} from "./data-server";
import {
  applyWeeklyGrant,
  effectiveUnitCap,
  isShieldActive,
  weekStartIsoForRollover,
} from "./turns";
import { computeTileCapacity, makeSeededRng } from "./combat";
import { getSpellForCasteAndType } from "./content";
import { rebuildWorldSnapshotServer } from "./world-snapshot";
import type {
  GamePlayer,
  GameTile,
  UnitStack,
  UnitType,
} from "./types";

const COLLECTIONS = {
  PLAYERS: "game_players",
  TILES: "game_tiles",
} as const;

const ATTACK_HARD_CAP = 15;

export type NpcPersonaName =
  | "builder"
  | "raider"
  | "magus"
  | "diplomat"
  | "warmonger"
  | "tactician";

interface Persona {
  name: NpcPersonaName;
  attacks: number;
  spells: number;
  preferredUnit: UnitType | null;
  deployFraction: number;
}

const PERSONAS: Record<NpcPersonaName, Persona> = {
  builder:    { name: "builder",    attacks: 2,  spells: 3, preferredUnit: null,    deployFraction: 0.5 },
  diplomat:   { name: "diplomat",   attacks: 1,  spells: 4, preferredUnit: null,    deployFraction: 0.4 },
  tactician:  { name: "tactician",  attacks: 8,  spells: 2, preferredUnit: null,    deployFraction: 0.65 },
  magus:      { name: "magus",      attacks: 5,  spells: 6, preferredUnit: "air",   deployFraction: 0.6 },
  raider:     { name: "raider",     attacks: 14, spells: 1, preferredUnit: "ground", deployFraction: 0.7 },
  warmonger:  { name: "warmonger",  attacks: 15, spells: 0, preferredUnit: "siege", deployFraction: 0.8 },
};

const PERSONA_NAMES: NpcPersonaName[] = Object.keys(PERSONAS) as NpcPersonaName[];

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h >>> 0;
}

function personaForUid(uid: string): Persona {
  return PERSONAS[PERSONA_NAMES[djb2(uid) % PERSONA_NAMES.length]!];
}

function sumStack(s: UnitStack): number {
  return s.ground + s.siege + s.air;
}

interface AttackCandidate {
  sourceTileId: string;
  targetTileId: string;
  defenderId: string;
  sourceUnits: UnitStack;
  targetCapacity: number;
}

function scoreCandidate(c: AttackCandidate, persona: Persona): number {
  const srcTotal = sumStack(c.sourceUnits);
  if (srcTotal <= 0) return -1;
  const preferredBoost = persona.preferredUnit
    ? c.sourceUnits[persona.preferredUnit] / Math.max(1, srcTotal)
    : 0.5;
  return srcTotal * 1.0 + preferredBoost * 50 + c.targetCapacity * 0.1;
}

function pickUnitsToSend(
  src: UnitStack,
  fraction: number,
  capRoom: number,
  preferred: UnitType | null
): UnitStack {
  const total = sumStack(src);
  if (total <= 0 || capRoom <= 0) return { ground: 0, siege: 0, air: 0 };
  let target = Math.min(Math.floor(total * fraction), capRoom);
  if (target <= 0) target = Math.min(1, total, capRoom);
  const result: UnitStack = { ground: 0, siege: 0, air: 0 };
  let remaining = target;
  const order: UnitType[] = preferred
    ? [preferred, ...(["ground", "siege", "air"] as UnitType[]).filter((t) => t !== preferred)]
    : ["ground", "siege", "air"];
  for (const t of order) {
    if (remaining <= 0) break;
    const take = Math.min(src[t], remaining);
    result[t] = take;
    remaining -= take;
  }
  return result;
}

interface NpcContext {
  player: GamePlayer;
  myTiles: GameTile[];
  myMilitary: GameTile[];
  myFoodCount: number;
  myMagicCount: number;
}

interface WorldSnapshot {
  npcs: Map<string, GamePlayer>;
  ownerByTile: Map<string, string>;
  npcTilesById: Map<string, GameTile>;
  tilesByOwner: Map<string, GameTile[]>;
}

async function loadWorldSnapshot(db: Firestore): Promise<WorldSnapshot> {
  const playersSnap = await db
    .collection(COLLECTIONS.PLAYERS)
    .where("isNpc", "==", true)
    .get();
  const npcs = new Map<string, GamePlayer>();
  for (const d of playersSnap.docs) npcs.set(d.id, d.data() as GamePlayer);

  const tilesSnap = await db.collection(COLLECTIONS.TILES).get();
  const ownerByTile = new Map<string, string>();
  const npcTilesById = new Map<string, GameTile>();
  const tilesByOwner = new Map<string, GameTile[]>();
  for (const d of tilesSnap.docs) {
    const t = d.data() as GameTile;
    if (t.ownerId) ownerByTile.set(t.tileId, t.ownerId);
    if (t.ownerId && npcs.has(t.ownerId)) {
      npcTilesById.set(t.tileId, t);
      const arr = tilesByOwner.get(t.ownerId) ?? [];
      arr.push(t);
      tilesByOwner.set(t.ownerId, arr);
    }
  }
  return { npcs, ownerByTile, npcTilesById, tilesByOwner };
}

function buildContext(uid: string, world: WorldSnapshot): NpcContext | null {
  const player = world.npcs.get(uid);
  if (!player) return null;
  const myTiles = world.tilesByOwner.get(uid) ?? [];
  const myMilitary = myTiles.filter((t) => t.type === "military");
  let foodCount = 0;
  let magicCount = 0;
  for (const t of myTiles) {
    if (t.type === "food") foodCount += 1;
    else if (t.type === "magic") magicCount += 1;
  }
  return { player, myTiles, myMilitary, myFoodCount: foodCount, myMagicCount: magicCount };
}

function findAttackCandidates(
  ctx: NpcContext,
  world: WorldSnapshot,
  persona: Persona,
  now: Date,
  rng: () => number
): AttackCandidate[] {
  const candidates: AttackCandidate[] = [];
  for (const src of ctx.myMilitary) {
    // BASE+SUPER: NPCs can draft from both pools, so the candidate filter
    // includes baseUnits in the deployable count. A tile with 0 SUPER and
    // 22 BASE ground is now a viable source for raids.
    const srcBase = src.baseUnits ?? { ground: 0, siege: 0, air: 0 };
    const srcDeployable = {
      ground: src.units.ground + srcBase.ground,
      siege: src.units.siege + srcBase.siege,
      air: src.units.air + srcBase.air,
    };
    if (sumStack(srcDeployable) < 5) continue;
    for (const neighborId of src.neighborTileIds) {
      const target = world.npcTilesById.get(neighborId);
      if (!target) continue;
      if (target.ownerId === ctx.player.userId) continue;
      const defender = world.npcs.get(target.ownerId!);
      if (!defender) continue;
      if (isShieldActive(defender, now)) continue;
      const targetCap = computeTileCapacity(
        target.type,
        defender.caste,
        target.upgradeIds,
        defender.activeUpgrades ?? {}
      );
      const open = Math.max(0, targetCap - sumStack(target.units));
      if (open < 1) continue;
      candidates.push({
        sourceTileId: src.tileId,
        targetTileId: target.tileId,
        defenderId: target.ownerId!,
        sourceUnits: srcDeployable,
        targetCapacity: open,
      });
    }
  }
  return candidates
    .map((c) => ({ c, s: scoreCandidate(c, persona) + rng() * 5 }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
}

interface ActionLog {
  builds: number;
  attacks: number;
  spellsCast: number;
  attackOutcomes: { captured: number; repelled: number; stalemate: number };
  errors: string[];
}

async function refreshContextFromDb(db: Firestore, ctx: NpcContext) {
  const fresh = await db
    .collection(COLLECTIONS.TILES)
    .where("ownerId", "==", ctx.player.userId)
    .get();
  const myTiles: GameTile[] = fresh.docs.map((d) => d.data() as GameTile);
  ctx.myTiles = myTiles;
  ctx.myMilitary = myTiles.filter((t) => t.type === "military");
  ctx.myFoodCount = myTiles.filter((t) => t.type === "food").length;
  ctx.myMagicCount = myTiles.filter((t) => t.type === "magic").length;
}

function makeBuildPlan(
  miltiles: GameTile[],
  totalCycles: number,
  preferred: UnitType,
  rng: () => number
): { tileId: string; unitType: UnitType; cycles: number }[] {
  if (miltiles.length === 0 || totalCycles <= 0) return [];
  const plan: { tileId: string; unitType: UnitType; cycles: number }[] = [];
  let cyclesLeft = totalCycles;
  const tileOrder = [...miltiles].sort(() => rng() - 0.5);
  let tileIdx = 0;
  while (cyclesLeft > 0) {
    const tile = tileOrder[tileIdx % tileOrder.length]!;
    const isPreferred = rng() < 0.8;
    const unitType: UnitType = isPreferred
      ? preferred
      : (["ground", "siege", "air"] as UnitType[]).filter((t) => t !== preferred)[
          Math.floor(rng() * 2)
        ]!;
    plan.push({ tileId: tile.tileId, unitType, cycles: 1 });
    cyclesLeft -= 1;
    tileIdx += 1;
  }
  const coalesced: { tileId: string; unitType: UnitType; cycles: number }[] = [];
  for (const e of plan) {
    const prev = coalesced[coalesced.length - 1];
    if (prev && prev.tileId === e.tileId && prev.unitType === e.unitType) {
      prev.cycles += e.cycles;
    } else {
      coalesced.push({ ...e });
    }
  }
  return coalesced;
}

async function spendNpcTurns(args: {
  db: Firestore;
  ctx: NpcContext;
  persona: Persona;
  world: WorldSnapshot;
  now: Date;
  dryRun: boolean;
}): Promise<ActionLog> {
  const { ctx, persona, world, now, dryRun } = args;
  const log: ActionLog = {
    builds: 0,
    attacks: 0,
    spellsCast: 0,
    attackOutcomes: { captured: 0, repelled: 0, stalemate: 0 },
    errors: [],
  };
  if (!ctx.player.caste) return log;
  const caste = ctx.player.caste;

  let player = ctx.player;
  const rng = makeSeededRng(`npc-week:${player.userId}:${now.toISOString().slice(0, 10)}`);

  // Phase 1: production spells.
  if (persona.spells > 0) {
    const spell = getSpellForCasteAndType(caste, "production");
    for (let i = 0; i < persona.spells; i++) {
      if (player.turnsRemaining < spell.turnCost) break;
      if (dryRun) {
        player = {
          ...player,
          turnsRemaining: player.turnsRemaining - spell.turnCost,
          turnsSpentTotal: player.turnsSpentTotal + spell.turnCost,
        };
        log.spellsCast += 1;
        continue;
      }
      try {
        const r = await castProductionSpellServer(player.userId, spell.id, now);
        player = r.player;
        log.spellsCast += 1;
      } catch (e) {
        log.errors.push(`spell: ${(e as Error).message}`);
        break;
      }
    }
  }

  // Phase 2: bulk builds up to cap.
  const currentCap = effectiveUnitCap(player, ctx.myFoodCount, ctx.myMagicCount);
  const room = Math.max(0, currentCap - player.stats.unitsAlive);
  const wantedCycles = Math.floor(room / 10);
  const attacksReserved = Math.min(persona.attacks, ATTACK_HARD_CAP);
  const buildBudgetTurns = Math.max(0, player.turnsRemaining - attacksReserved);
  const cyclesAffordable = Math.floor(buildBudgetTurns / 5);
  let cyclesLeft = Math.min(wantedCycles, cyclesAffordable);

  if (cyclesLeft > 0 && ctx.myMilitary.length > 0) {
    while (cyclesLeft > 0) {
      const chunk = Math.min(cyclesLeft, 100);
      const plan = makeBuildPlan(ctx.myMilitary, chunk, persona.preferredUnit ?? "ground", rng);
      if (plan.length === 0) break;
      if (dryRun) {
        player = {
          ...player,
          turnsRemaining: player.turnsRemaining - chunk * 5,
          turnsSpentTotal: player.turnsSpentTotal + chunk * 5,
          stats: { ...player.stats, unitsAlive: player.stats.unitsAlive + chunk * 10 },
        };
        log.builds += chunk;
        cyclesLeft -= chunk;
        continue;
      }
      try {
        const r = await bulkBuildUnitsServer(player.userId, plan, now);
        player = r.player;
        log.builds += chunk;
        cyclesLeft -= chunk;
        if (r.stoppedEarly) break;
      } catch (e) {
        log.errors.push(`bulkBuild: ${(e as Error).message}`);
        break;
      }
    }
  }

  // Phase 3: attacks.
  if (persona.attacks > 0 && !dryRun) {
    await refreshContextFromDb(args.db, ctx);
  }
  let attacksRemaining = Math.min(persona.attacks, ATTACK_HARD_CAP);
  while (attacksRemaining > 0 && player.turnsRemaining >= 1) {
    const candidates = findAttackCandidates(ctx, world, persona, now, rng);
    const picked = candidates.shift();
    if (!picked) break;
    const send = pickUnitsToSend(
      picked.sourceUnits,
      persona.deployFraction,
      picked.targetCapacity,
      persona.preferredUnit
    );
    if (sumStack(send) === 0) {
      const src = ctx.myMilitary.find((t) => t.tileId === picked.sourceTileId);
      if (src) src.units = { ground: 0, siege: 0, air: 0 };
      continue;
    }
    if (dryRun) {
      player = {
        ...player,
        turnsRemaining: player.turnsRemaining - 1,
        turnsSpentTotal: player.turnsSpentTotal + 1,
      };
      const src = ctx.myMilitary.find((t) => t.tileId === picked.sourceTileId);
      if (src) {
        src.units = {
          ground: src.units.ground - send.ground,
          siege: src.units.siege - send.siege,
          air: src.units.air - send.air,
        };
      }
      log.attacks += 1;
      attacksRemaining -= 1;
      continue;
    }
    try {
      const r = await attackTileServer({
        attackerId: player.userId,
        sourceTileId: picked.sourceTileId,
        targetTileId: picked.targetTileId,
        units: send,
        offenseSpellId: null,
        now,
      });
      player = r.attackerPlayer;
      log.attacks += 1;
      log.attackOutcomes[r.attack.outcome] += 1;
      const src = ctx.myMilitary.find((t) => t.tileId === picked.sourceTileId);
      if (src) src.units = r.sourceTile.units;
      if (r.attack.outcome === "captured") {
        ctx.myTiles.push(r.targetTile);
        if (r.targetTile.type === "military") ctx.myMilitary.push(r.targetTile);
        if (r.targetTile.type === "food") ctx.myFoodCount += 1;
        if (r.targetTile.type === "magic") ctx.myMagicCount += 1;
        world.npcTilesById.delete(r.targetTile.tileId);
        const defenderArr = world.tilesByOwner.get(picked.defenderId);
        if (defenderArr) {
          world.tilesByOwner.set(
            picked.defenderId,
            defenderArr.filter((t) => t.tileId !== r.targetTile.tileId)
          );
        }
        world.npcTilesById.set(r.targetTile.tileId, r.targetTile);
        const mine = world.tilesByOwner.get(player.userId) ?? [];
        mine.push(r.targetTile);
        world.tilesByOwner.set(player.userId, mine);
      } else {
        world.npcTilesById.set(r.targetTile.tileId, r.targetTile);
      }
    } catch (e) {
      log.errors.push(`attack: ${(e as Error).message}`);
    }
    attacksRemaining -= 1;
  }

  // Phase 4: dump leftover budget on more builds, if any cap room.
  if (!dryRun && player.turnsRemaining >= 5) {
    await refreshContextFromDb(args.db, ctx);
    const cap = effectiveUnitCap(player, ctx.myFoodCount, ctx.myMagicCount);
    const dumpRoom = Math.max(0, cap - player.stats.unitsAlive);
    let dumpCycles = Math.min(
      Math.floor(dumpRoom / 10),
      Math.floor(player.turnsRemaining / 5)
    );
    while (dumpCycles > 0 && ctx.myMilitary.length > 0) {
      const chunk = Math.min(dumpCycles, 100);
      const plan = makeBuildPlan(ctx.myMilitary, chunk, persona.preferredUnit ?? "ground", rng);
      if (plan.length === 0) break;
      try {
        const r = await bulkBuildUnitsServer(player.userId, plan, now);
        player = r.player;
        log.builds += chunk;
        dumpCycles -= chunk;
        if (r.stoppedEarly) break;
      } catch (e) {
        log.errors.push(`bulkBuild(dump): ${(e as Error).message}`);
        break;
      }
    }
  }

  return log;
}

async function applyGrantIfDue(args: {
  db: Firestore;
  player: GamePlayer;
  weekStartIso: string;
  now: Date;
  dryRun: boolean;
}): Promise<{ granted: boolean; player: GamePlayer }> {
  const { db, player, weekStartIso, now, dryRun } = args;
  if (player.lastWeeklyGrantWeekStart === weekStartIso) {
    return { granted: false, player };
  }
  const next = applyWeeklyGrant(player, weekStartIso, now);
  if (dryRun) return { granted: true, player: next };
  await db.collection(COLLECTIONS.PLAYERS).doc(player.userId).update({
    turnsRemaining: next.turnsRemaining,
    lastWeeklyGrantAt: next.lastWeeklyGrantAt,
    lastWeeklyGrantWeekStart: next.lastWeeklyGrantWeekStart,
    updatedAt: next.updatedAt,
  });
  return { granted: true, player: next };
}

export interface NpcWeeklyPerPlayer {
  uid: string;
  displayName: string;
  caste: string | null;
  persona: NpcPersonaName;
  builds: number;
  attacks: number;
  captured: number;
  repelled: number;
  stalemate: number;
  spellsCast: number;
  errorCount: number;
}

export interface NpcWeeklySummary {
  weekStartIso: string;
  scanned: number;
  granted: number;
  skippedAlreadyGranted: number;
  totals: {
    builds: number;
    attacks: number;
    spellsCast: number;
    captured: number;
    repelled: number;
    stalemate: number;
    errors: number;
  };
  perPlayer: NpcWeeklyPerPlayer[];
}

export interface RunNpcWeeklyOptions {
  weekStartIso?: string;
  dryRun?: boolean;
  limit?: number | null;
}

// Iterates every NPC, applies the weekly grant, then spends ~all 100 turns
// per persona-driven action plan. Idempotent per (player × weekStartIso).
export async function runNpcWeeklyServer(
  opts: RunNpcWeeklyOptions = {}
): Promise<NpcWeeklySummary> {
  const dryRun = opts.dryRun ?? false;
  const limit = opts.limit ?? null;
  const now = new Date();
  const weekStartIso = opts.weekStartIso ?? weekStartIsoForRollover(now);

  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not initialized");

  const world = await loadWorldSnapshot(db);

  const summary: NpcWeeklySummary = {
    weekStartIso,
    scanned: world.npcs.size,
    granted: 0,
    skippedAlreadyGranted: 0,
    totals: {
      builds: 0,
      attacks: 0,
      spellsCast: 0,
      captured: 0,
      repelled: 0,
      stalemate: 0,
      errors: 0,
    },
    perPlayer: [],
  };

  // Shuffle order so weekly conflicts don't always favor early-uid NPCs.
  const orderRng = makeSeededRng(`npc-weekly-order:${weekStartIso}`);
  const uids = [...world.npcs.keys()].sort(() => orderRng() - 0.5);

  let processed = 0;
  for (const uid of uids) {
    if (limit !== null && processed >= limit) break;
    processed += 1;

    let player = world.npcs.get(uid)!;

    const grantRes = await applyGrantIfDue({ db, player, weekStartIso, now, dryRun });
    if (!grantRes.granted) {
      summary.skippedAlreadyGranted += 1;
      continue;
    }
    summary.granted += 1;
    player = grantRes.player;
    world.npcs.set(uid, player);

    const ctx = buildContext(uid, world);
    if (!ctx) continue;
    ctx.player = player;
    const persona = personaForUid(uid);

    const log = await spendNpcTurns({ db, ctx, persona, world, now, dryRun });
    summary.totals.builds += log.builds;
    summary.totals.attacks += log.attacks;
    summary.totals.spellsCast += log.spellsCast;
    summary.totals.captured += log.attackOutcomes.captured;
    summary.totals.repelled += log.attackOutcomes.repelled;
    summary.totals.stalemate += log.attackOutcomes.stalemate;
    summary.totals.errors += log.errors.length;

    summary.perPlayer.push({
      uid,
      displayName: player.displayName,
      caste: player.caste,
      persona: persona.name,
      builds: log.builds,
      attacks: log.attacks,
      captured: log.attackOutcomes.captured,
      repelled: log.attackOutcomes.repelled,
      stalemate: log.attackOutcomes.stalemate,
      spellsCast: log.spellsCast,
      errorCount: log.errors.length,
    });

    if (log.errors.length > 0) {
      logger.warn("NPC weekly errors", {
        uid,
        weekStartIso,
        errors: log.errors.slice(0, 3),
      });
    }
  }

  logger.info("NPC weekly run complete", {
    weekStartIso,
    scanned: summary.scanned,
    granted: summary.granted,
    skippedAlreadyGranted: summary.skippedAlreadyGranted,
    totals: summary.totals,
  });

  // The cron has touched many tiles + player docs; rebuild the world
  // snapshot now so the next read by any human serves fresh data without
  // waiting up to 5 min for the periodic snapshot cron.
  if (!dryRun && summary.granted > 0) {
    try {
      await rebuildWorldSnapshotServer();
    } catch (e) {
      logger.warn("World snapshot rebuild after NPC weekly failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return summary;
}
