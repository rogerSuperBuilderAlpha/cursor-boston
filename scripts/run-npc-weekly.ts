#!/usr/bin/env node
/**
 * Weekly NPC turn-spender. Designed to run once per week, ideally after the
 * GitHub Actions `game-weekly-rollover` cron (which only grants turns to
 * players with merged PRs — NPCs don't qualify).
 *
 * Per NPC (any player doc with `isNpc == true`):
 *   1. Apply weekly grant (turnsRemaining = 100), idempotent per week-start.
 *   2. Pick a persona deterministically from the uid → drives action mix.
 *   3. Spend ~all 100 turns across:
 *        - tier-1 production spell casts (5 turns)
 *        - bulk unit builds up to food cap        (5 turns / 10 units)
 *        - up to 15 attacks vs. adjacent OTHER NPC tiles  (1 turn each;
 *          humans are never targeted)
 *
 * Re-running the same week is a no-op for NPCs already granted that week.
 *
 * Usage:
 *   npx tsx scripts/run-npc-weekly.ts [--week=YYYY-MM-DD] [--dry-run] [--limit=N]
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import {
  attackTileServer,
  bulkBuildUnitsServer,
  castProductionSpellServer,
} from "../lib/game/data-server";
import {
  applyWeeklyGrant,
  isShieldActive,
  weekStartIsoForRollover,
} from "../lib/game/turns";
import {
  computeTileCapacity,
  makeSeededRng,
} from "../lib/game/combat";
import { effectiveUnitCap } from "../lib/game/turns";
import { getSpellForCasteAndType } from "../lib/game/content";
import type {
  GamePlayer,
  GameTile,
  UnitStack,
  UnitType,
} from "../lib/game/types";

const COLLECTIONS = {
  PLAYERS: "game_players",
  TILES: "game_tiles",
} as const;

const ATTACK_HARD_CAP = 15;

type PersonaName =
  | "builder"
  | "raider"
  | "magus"
  | "diplomat"
  | "warmonger"
  | "tactician";

interface Persona {
  name: PersonaName;
  // Target attack count this week (clamped to 0..ATTACK_HARD_CAP).
  attacks: number;
  // Number of production-spell casts this week (each costs 5 turns).
  spells: number;
  // If non-null, attacker prefers this unit type when picking a source tile.
  preferredUnit: UnitType | null;
  // Fraction of source-tile units to deploy in an attack (clamped 0.3–0.95).
  deployFraction: number;
}

const PERSONAS: Record<PersonaName, Persona> = {
  builder:    { name: "builder",    attacks: 2,  spells: 3, preferredUnit: null,    deployFraction: 0.5 },
  diplomat:   { name: "diplomat",   attacks: 1,  spells: 4, preferredUnit: null,    deployFraction: 0.4 },
  tactician:  { name: "tactician",  attacks: 8,  spells: 2, preferredUnit: null,    deployFraction: 0.65 },
  magus:      { name: "magus",      attacks: 5,  spells: 6, preferredUnit: "air",   deployFraction: 0.6 },
  raider:     { name: "raider",     attacks: 14, spells: 1, preferredUnit: "ground", deployFraction: 0.7 },
  warmonger:  { name: "warmonger",  attacks: 15, spells: 0, preferredUnit: "siege", deployFraction: 0.8 },
};

const PERSONA_NAMES: PersonaName[] = Object.keys(PERSONAS) as PersonaName[];

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}

function personaForUid(uid: string): Persona {
  const idx = djb2(uid) % PERSONA_NAMES.length;
  return PERSONAS[PERSONA_NAMES[idx]!];
}

function sumStack(s: UnitStack): number {
  return s.ground + s.siege + s.air;
}

interface AttackCandidate {
  sourceTileId: string;
  targetTileId: string;
  defenderId: string;
  // Total attacker units available on the source tile at planning time.
  sourceUnits: UnitStack;
  // Open capacity on the target tile at planning time.
  targetCapacity: number;
}

// Scores attack candidates by a "weakness * affordability" heuristic. Targets
// with low defenders + high open capacity rise; sources with lots of units
// rise. Persona's preferredUnit nudges sources that have that unit type.
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
  // Target send size as fraction of source units, but cap to target's open
  // space. We never send fewer than 1 unit if we can.
  let target = Math.min(Math.floor(total * fraction), capRoom);
  if (target <= 0) target = Math.min(1, total, capRoom);

  const result: UnitStack = { ground: 0, siege: 0, air: 0 };
  let remaining = target;

  // First fill from preferred type if specified.
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
  // All tiles owned by this NPC.
  myTiles: GameTile[];
  myMilitary: GameTile[];
  myFoodCount: number;
  myMagicCount: number;
}

interface WorldSnapshot {
  // All NPC players keyed by uid. Used to filter "attack only NPCs".
  npcs: Map<string, GamePlayer>;
  // tileId → owner (for adjacency lookups). Includes both NPC and human tiles.
  ownerByTile: Map<string, string>;
  // tileId → tile data (only NPC-owned tiles, since those are our only valid targets).
  npcTilesById: Map<string, GameTile>;
  // Owner uid → list of their tiles (NPC owners only).
  tilesByOwner: Map<string, GameTile[]>;
}

async function loadWorldSnapshot(db: Firestore): Promise<WorldSnapshot> {
  const playersSnap = await db
    .collection(COLLECTIONS.PLAYERS)
    .where("isNpc", "==", true)
    .get();
  const npcs = new Map<string, GamePlayer>();
  for (const d of playersSnap.docs) {
    npcs.set(d.id, d.data() as GamePlayer);
  }

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

function buildContext(
  uid: string,
  world: WorldSnapshot
): NpcContext | null {
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
  return {
    player,
    myTiles,
    myMilitary,
    myFoodCount: foodCount,
    myMagicCount: magicCount,
  };
}

function findAttackCandidates(
  ctx: NpcContext,
  world: WorldSnapshot,
  persona: Persona,
  now: Date,
  rng: () => number
): AttackCandidate[] {
  const candidates: AttackCandidate[] = [];
  // Each pair (source mil tile of mine, adjacent target NPC tile NOT mine).
  // Filter targets owned by shielded NPCs (would throw GameShieldedError).
  for (const src of ctx.myMilitary) {
    if (sumStack(src.units) < 5) continue;
    for (const neighborId of src.neighborTileIds) {
      const target = world.npcTilesById.get(neighborId);
      if (!target) continue; // neighbor is unrevealed, human-owned, or unowned
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
        sourceUnits: { ...src.units },
        targetCapacity: open,
      });
    }
  }

  // Score and sort, then add a small random jitter so equally-scored ties
  // don't all collapse onto the same source.
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
  if (!ctx.player.caste) return log; // can't act without a caste
  const caste = ctx.player.caste;

  let player = ctx.player;
  const rng = makeSeededRng(`npc-week:${player.userId}:${now.toISOString().slice(0, 10)}`);

  // ── Phase 1: production spells (cheap & low risk) ──
  if (persona.spells > 0) {
    const spell = getSpellForCasteAndType(caste, "production");
    const targetCasts = persona.spells;
    for (let i = 0; i < targetCasts; i++) {
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

  // ── Phase 2: bulk unit builds up to cap ──
  // Compute current cap from latest land counts. We rely on the in-memory
  // land counts (stable across this script run; food/magic don't shift).
  const currentCap = effectiveUnitCap(
    player,
    ctx.myFoodCount,
    ctx.myMagicCount
  );
  const room = Math.max(0, currentCap - player.stats.unitsAlive);
  // Each cycle = 5 turns → 10 units. Cap each call to 100 cycles per
  // bulkBuildUnitsServer's hard limit.
  const wantedCycles = Math.floor(room / 10);
  // Reserve attack budget: keep enough turns for max-attack count. Each attack
  // costs 1 turn (no offense spells in v1).
  const attacksReserved = Math.min(persona.attacks, ATTACK_HARD_CAP);
  const buildBudgetTurns = Math.max(0, player.turnsRemaining - attacksReserved);
  const cyclesAffordable = Math.floor(buildBudgetTurns / 5);
  let cyclesLeft = Math.min(wantedCycles, cyclesAffordable);

  if (cyclesLeft > 0 && ctx.myMilitary.length > 0) {
    while (cyclesLeft > 0) {
      const chunk = Math.min(cyclesLeft, 100);
      // Round-robin distribute chunk across military tiles. Each tile in the
      // plan can have many cycles; bulkBuildUnitsServer will dedupe writes.
      const plan = makeBuildPlan(
        ctx.myMilitary,
        chunk,
        persona.preferredUnit ?? "ground",
        rng
      );
      if (plan.length === 0) break;
      if (dryRun) {
        player = {
          ...player,
          turnsRemaining: player.turnsRemaining - chunk * 5,
          turnsSpentTotal: player.turnsSpentTotal + chunk * 5,
          stats: {
            ...player.stats,
            unitsAlive: player.stats.unitsAlive + chunk * 10,
          },
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
        if (r.stoppedEarly) {
          break;
        }
      } catch (e) {
        log.errors.push(`bulkBuild: ${(e as Error).message}`);
        break;
      }
    }
  }

  // ── Phase 3: attacks (live re-read of source tile units required) ──
  // Re-fetch the source tiles from the DB for the latest unit counts (the
  // builds above changed them). Cheaper than re-reading the world snapshot.
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
      // Mark this source as drained so we don't re-pick it.
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

      // Update local state so subsequent candidate scoring is fresh:
      //   - source tile unit counts decreased (and possibly target captured).
      const src = ctx.myMilitary.find((t) => t.tileId === picked.sourceTileId);
      if (src) src.units = r.sourceTile.units;
      if (r.attack.outcome === "captured") {
        // Add captured tile to my list (now mine, type unchanged for now).
        ctx.myTiles.push(r.targetTile);
        if (r.targetTile.type === "military") ctx.myMilitary.push(r.targetTile);
        if (r.targetTile.type === "food") ctx.myFoodCount += 1;
        if (r.targetTile.type === "magic") ctx.myMagicCount += 1;
        // Remove from defender's tile list in world snapshot (so we don't
        // accidentally re-target it).
        world.npcTilesById.delete(r.targetTile.tileId);
        const defenderArr = world.tilesByOwner.get(picked.defenderId);
        if (defenderArr) {
          world.tilesByOwner.set(
            picked.defenderId,
            defenderArr.filter((t) => t.tileId !== r.targetTile.tileId)
          );
        }
        // Add to my own list in world snapshot.
        world.npcTilesById.set(r.targetTile.tileId, r.targetTile);
        const mine = world.tilesByOwner.get(player.userId) ?? [];
        mine.push(r.targetTile);
        world.tilesByOwner.set(player.userId, mine);
      } else {
        // Update defender's tile in snapshot with post-combat unit counts.
        world.npcTilesById.set(r.targetTile.tileId, r.targetTile);
      }
    } catch (e) {
      log.errors.push(`attack: ${(e as Error).message}`);
      // Don't break — try the next candidate; the failure may be specific
      // (e.g. tile filled up between scan and attack).
    }
    attacksRemaining -= 1;
  }

  // ── Phase 4: dump leftover budget on more builds, if any cap room ──
  if (!dryRun && player.turnsRemaining >= 5) {
    await refreshContextFromDb(args.db, ctx);
    const cap = effectiveUnitCap(
      player,
      ctx.myFoodCount,
      ctx.myMagicCount
    );
    const dumpRoom = Math.max(0, cap - player.stats.unitsAlive);
    let dumpCycles = Math.min(
      Math.floor(dumpRoom / 10),
      Math.floor(player.turnsRemaining / 5)
    );
    while (dumpCycles > 0 && ctx.myMilitary.length > 0) {
      const chunk = Math.min(dumpCycles, 100);
      const plan = makeBuildPlan(
        ctx.myMilitary,
        chunk,
        persona.preferredUnit ?? "ground",
        rng
      );
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
  // Split cycles round-robin across tiles, with the preferred unit as the
  // type. 80% preferred, 20% rotating among the others, so personas read
  // visibly different on the leaderboard while still keeping some breadth.
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
  // Coalesce contiguous (tileId, unitType) entries to keep the plan compact.
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
  if (dryRun) {
    return { granted: true, player: next };
  }
  await db
    .collection(COLLECTIONS.PLAYERS)
    .doc(player.userId)
    .update({
      turnsRemaining: next.turnsRemaining,
      lastWeeklyGrantAt: next.lastWeeklyGrantAt,
      lastWeeklyGrantWeekStart: next.lastWeeklyGrantWeekStart,
      updatedAt: next.updatedAt,
    });
  return { granted: true, player: next };
}

function parseArgs(argv: string[]): {
  weekStartIso: string | null;
  dryRun: boolean;
  limit: number | null;
} {
  let weekStartIso: string | null = null;
  let dryRun = false;
  let limit: number | null = null;
  for (const a of argv) {
    if (a.startsWith("--week=")) weekStartIso = a.slice("--week=".length);
    else if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--limit=")) limit = Number.parseInt(a.slice("--limit=".length), 10);
  }
  return { weekStartIso, dryRun, limit };
}

async function main() {
  const { weekStartIso: weekArg, dryRun, limit } = parseArgs(process.argv.slice(2));
  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }
  const now = new Date();
  const weekStartIso = weekArg ?? weekStartIsoForRollover(now);
  console.log(
    `[npc-weekly] week=${weekStartIso} dryRun=${dryRun} limit=${limit ?? "all"}`
  );

  const world = await loadWorldSnapshot(db);
  console.log(`[npc-weekly] loaded ${world.npcs.size} NPC players`);

  let processed = 0;
  let granted = 0;
  let skipped = 0;
  const totals = {
    builds: 0,
    attacks: 0,
    spellsCast: 0,
    captured: 0,
    repelled: 0,
    stalemate: 0,
    errors: 0,
  };

  // Shuffle order so weekly conflicts don't always favor early-uid NPCs.
  const orderRng = makeSeededRng(`npc-weekly-order:${weekStartIso}`);
  const uids = [...world.npcs.keys()].sort(() => orderRng() - 0.5);

  for (const uid of uids) {
    if (limit !== null && processed >= limit) break;
    processed += 1;

    let player = world.npcs.get(uid)!;

    const grantRes = await applyGrantIfDue({
      db,
      player,
      weekStartIso,
      now,
      dryRun,
    });
    if (!grantRes.granted) {
      skipped += 1;
      continue;
    }
    granted += 1;
    player = grantRes.player;
    world.npcs.set(uid, player);

    if (isShieldActive(player, now)) {
      // Shielded NPCs can't attack; they can still build and cast spells.
      // Carry on but the persona's attacks will all fail; no-op the attack
      // count to keep the run quiet.
    }

    const ctx = buildContext(uid, world);
    if (!ctx) continue;
    ctx.player = player;
    const persona = personaForUid(uid);

    const log = await spendNpcTurns({ db, ctx, persona, world, now, dryRun });

    totals.builds += log.builds;
    totals.attacks += log.attacks;
    totals.spellsCast += log.spellsCast;
    totals.captured += log.attackOutcomes.captured;
    totals.repelled += log.attackOutcomes.repelled;
    totals.stalemate += log.attackOutcomes.stalemate;
    totals.errors += log.errors.length;

    console.log(
      `[npc-weekly] ${player.displayName} (${persona.name}, ${player.caste}): ` +
        `builds=${log.builds} attacks=${log.attacks} (cap=${log.attackOutcomes.captured}/rep=${log.attackOutcomes.repelled}/sta=${log.attackOutcomes.stalemate}) ` +
        `spells=${log.spellsCast} errors=${log.errors.length}`
    );
    if (log.errors.length > 0) {
      for (const err of log.errors.slice(0, 3)) console.log(`    ! ${err}`);
    }
  }

  console.log(
    `\n[npc-weekly] Done. processed=${processed} granted=${granted} skipped=${skipped}`
  );
  console.log(
    `  builds=${totals.builds} attacks=${totals.attacks} ` +
      `(captured=${totals.captured}, repelled=${totals.repelled}, stalemate=${totals.stalemate}) ` +
      `spells=${totals.spellsCast} errors=${totals.errors}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
