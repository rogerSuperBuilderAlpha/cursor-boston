#!/usr/bin/env node
/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * One-off NPC blitz: grant +50 turns to every NPC, then spend those turns
 * attack-first. Fallback when an NPC has no attack candidates:
 *   - bordering enemy tiles but source < 5 units ⇒ recruit 1 cycle (+10 units,
 *     5 turns) on the bordering tile with the most enemy neighbors, then loop.
 *   - no bordering enemy tiles ⇒ bail (the NPC is isolated and can't act).
 *
 * Idempotent via `npcBlitzGrantKey` on the player doc — re-running with the
 * same GRANT_KEY skips NPCs already granted this round. Dry-run is the
 * default; pass --apply to actually write.
 *
 * Usage:
 *   npx tsx scripts/run-npc-50-attack-blitz.ts                 # dry-run
 *   npx tsx scripts/run-npc-50-attack-blitz.ts --apply         # commit
 *   npx tsx scripts/run-npc-50-attack-blitz.ts --apply --limit=5
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON (admin SDK).
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import {
  attackTileServer,
  bulkBuildUnitsServer,
  distributeTileServer,
  farExpeditionExploreServer,
  FAR_EXPEDITION_TURN_COST,
} from "../lib/game/data-server";
import { computeTileCapacity } from "../lib/game/combat";
import { effectiveUnitCap, isShieldActive } from "../lib/game/turns";
import { rebuildWorldSnapshotServer } from "../lib/game/world-snapshot";
import type { GamePlayer, GameTile, UnitStack, UnitType } from "../lib/game/types";


const TURNS_GRANTED = 50;
const GRANT_KEY = "2026-05-13-npc-blitz";
const GRANT_STAMP_FIELD = "npcBlitzGrantKey";
const PLAYERS = "game_players";
const TILES = "game_tiles";

// Mirrors PERSONAS in lib/game/npc-weekly.ts. Duplicated intentionally —
// this is a one-off blitz and we don't want to widen the lib's public API
// for a script that gets archived after it runs.
type PersonaName =
  | "builder"
  | "raider"
  | "magus"
  | "diplomat"
  | "warmonger"
  | "tactician";

interface Persona {
  preferredUnit: UnitType | null;
  deployFraction: number;
}

const PERSONAS: Record<PersonaName, Persona> = {
  builder:   { preferredUnit: null,     deployFraction: 0.5 },
  diplomat:  { preferredUnit: null,     deployFraction: 0.4 },
  tactician: { preferredUnit: null,     deployFraction: 0.65 },
  magus:     { preferredUnit: "air",    deployFraction: 0.6 },
  raider:    { preferredUnit: "ground", deployFraction: 0.7 },
  warmonger: { preferredUnit: "siege",  deployFraction: 0.8 },
};
const PERSONA_NAMES: PersonaName[] = Object.keys(PERSONAS) as PersonaName[];

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h >>> 0;
}

function personaNameForUid(uid: string): PersonaName {
  return PERSONA_NAMES[djb2(uid) % PERSONA_NAMES.length]!;
}

function sumStack(s: UnitStack): number {
  return s.ground + s.siege + s.air;
}

// ──────────────────────────────────────────────────────────────────────────
// World snapshot — every player (NPC + human) and every tile. Humans are
// included because in this world only ~1/50 NPCs has an NPC-vs-NPC border;
// the rest only border humans. The blitz widens findAttackCandidates to
// allow human defenders so attacks actually fire.
// ──────────────────────────────────────────────────────────────────────────
interface World {
  allPlayers: Map<string, GamePlayer>;
  isNpc: Map<string, boolean>;
  tilesById: Map<string, GameTile>;
}

async function loadWorld(db: Firestore): Promise<World> {
  const playersSnap = await db.collection(PLAYERS).get();
  const allPlayers = new Map<string, GamePlayer>();
  const isNpc = new Map<string, boolean>();
  for (const d of playersSnap.docs) {
    const p = d.data() as GamePlayer & { isNpc?: boolean };
    allPlayers.set(d.id, p);
    isNpc.set(d.id, p.isNpc === true);
  }

  const tilesSnap = await db.collection(TILES).get();
  const tilesById = new Map<string, GameTile>();
  for (const d of tilesSnap.docs) {
    tilesById.set(d.id, d.data() as GameTile);
  }
  return { allPlayers, isNpc, tilesById };
}

async function refreshMyTiles(db: Firestore, uid: string): Promise<GameTile[]> {
  const snap = await db.collection(TILES).where("ownerId", "==", uid).get();
  return snap.docs.map((d) => d.data() as GameTile);
}

// ──────────────────────────────────────────────────────────────────────────
// Attack candidate scoring — mirrors npc-weekly.ts but without RNG noise
// (we want deterministic dry-run output) and never targets humans.
// ──────────────────────────────────────────────────────────────────────────
interface AttackCandidate {
  sourceTileId: string;
  targetTileId: string;
  defenderId: string;
  sourceUnits: UnitStack;
  targetCapacity: number;
}

function findAttackCandidates(
  attackerUid: string,
  myMilitary: GameTile[],
  world: World,
  now: Date
): AttackCandidate[] {
  const out: AttackCandidate[] = [];
  for (const src of myMilitary) {
    if (sumStack(src.units) < 5) continue;
    for (const neighborId of src.neighborTileIds) {
      const target = world.tilesById.get(neighborId);
      if (!target) continue; // frontier / unrevealed
      if (!target.ownerId) continue; // unowned (no one to attack)
      if (target.ownerId === attackerUid) continue;
      const defender = world.allPlayers.get(target.ownerId);
      if (!defender) continue;
      if (isShieldActive(defender, now)) continue;
      const cap = computeTileCapacity(
        target.type,
        defender.caste,
        target.upgradeIds,
        defender.activeUpgrades ?? {}
      );
      const open = Math.max(0, cap - sumStack(target.units));
      if (open < 1) continue;
      out.push({
        sourceTileId: src.tileId,
        targetTileId: target.tileId,
        defenderId: target.ownerId,
        sourceUnits: { ...src.units },
        targetCapacity: open,
      });
    }
  }
  return out;
}

function scoreCandidate(c: AttackCandidate, persona: Persona): number {
  const total = sumStack(c.sourceUnits);
  const boost = persona.preferredUnit
    ? c.sourceUnits[persona.preferredUnit] / Math.max(1, total)
    : 0.5;
  return total * 1.0 + boost * 50 + c.targetCapacity * 0.1;
}

function pickUnitsToSend(
  src: UnitStack,
  persona: Persona,
  capRoom: number
): UnitStack {
  const total = sumStack(src);
  if (total <= 0 || capRoom <= 0) return { ground: 0, siege: 0, air: 0 };
  let want = Math.min(Math.floor(total * persona.deployFraction), capRoom);
  if (want <= 0) want = Math.min(1, total, capRoom);
  const result: UnitStack = { ground: 0, siege: 0, air: 0 };
  let remaining = want;
  const order: UnitType[] = persona.preferredUnit
    ? [
        persona.preferredUnit,
        ...(["ground", "siege", "air"] as UnitType[]).filter(
          (t) => t !== persona.preferredUnit
        ),
      ]
    : ["ground", "siege", "air"];
  for (const t of order) {
    if (remaining <= 0) break;
    const take = Math.min(src[t], remaining);
    result[t] = take;
    remaining -= take;
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────────────
// Per-NPC blitz loop
// ──────────────────────────────────────────────────────────────────────────
interface NpcStats {
  uid: string;
  displayName: string;
  persona: PersonaName;
  turnsBefore: number;
  turnsAfter: number;
  attacks: number;
  captured: number;
  repelled: number;
  stalemate: number;
  recruitsCycles: number;
  expansions: number;
  bailReason: string | null;
}

async function runOneNpc(args: {
  db: Firestore;
  player: GamePlayer;
  turnsBefore: number;
  world: World;
  dryRun: boolean;
  now: Date;
  personaName: PersonaName;
  expand: boolean;
  budgetCeiling: number;
}): Promise<NpcStats> {
  const { db, world, dryRun, now, personaName, expand, budgetCeiling } = args;
  let player = args.player;
  const uid = player.userId;
  const persona = PERSONAS[personaName];

  const stats: NpcStats = {
    uid,
    displayName: player.displayName,
    persona: personaName,
    turnsBefore: args.turnsBefore,
    turnsAfter: player.turnsRemaining,
    attacks: 0,
    captured: 0,
    repelled: 0,
    stalemate: 0,
    recruitsCycles: 0,
    expansions: 0,
    bailReason: null,
  };

  if (!player.caste) {
    stats.bailReason = "no caste";
    return stats;
  }

  let myTiles: GameTile[] = dryRun
    ? [...world.tilesById.values()]
        .filter((t) => t.ownerId === uid)
        .map((t) => ({ ...t, units: { ...t.units } }))
    : await refreshMyTiles(db, uid);
  let myMilitary = myTiles.filter((t) => t.type === "military");
  let myFood = myTiles.filter((t) => t.type === "food").length;
  let myMagic = myTiles.filter((t) => t.type === "magic").length;

  // In --expand mode we drain the NPC's turn bucket — keep cycling attack /
  // recruit / expand until they're truly stuck. In blitz mode we cap at
  // budgetCeiling so the +50 grant isn't an unbounded spend trigger.
  let spent = 0;
  const noBudget = expand;
  const maxIters = 500;
  let iter = 0;

  // ── Closures share local state (player, spent, myFood, myMagic, etc.). ──
  async function plantFoodTile(): Promise<boolean> {
    if (player.turnsRemaining < 3) return false;
    if (!noBudget && spent + 3 > budgetCeiling) return false;
    if (dryRun) {
      spent += 3;
      myFood += 1;
      player = { ...player, turnsRemaining: player.turnsRemaining - 3 };
      return true;
    }
    try {
      const fxR = await farExpeditionExploreServer(uid, now);
      player = fxR.player;
      spent += FAR_EXPEDITION_TURN_COST;
      const id = fxR.tile.tileId;
      world.tilesById.set(id, fxR.tile);
      const dR = await distributeTileServer(uid, id, "food", now);
      player = dR.player;
      spent += 1;
      world.tilesById.set(id, dR.tile);
      myFood += 1;
      return true;
    } catch {
      return false;
    }
  }

  // Recruit 1 cycle on the given military tile. If the server rejects with a
  // cap error (or stoppedEarly because cap), plant a food tile and retry —
  // food tiles raise the cap by +5 each, military cycle wants +10 units.
  // Hard upper bound on food plants prevents a runaway loop if the server
  // keeps rejecting for non-cap reasons.
  async function recruitWithFoodFallback(
    tileId: string,
    unitType: UnitType
  ): Promise<boolean> {
    const MAX_FOOD_RETRIES = 40;
    for (let attempt = 0; attempt < MAX_FOOD_RETRIES; attempt++) {
      const cap = effectiveUnitCap(player, myFood, myMagic);
      if (player.stats.unitsAlive + 10 > cap) {
        if (!(await plantFoodTile())) return false;
        continue;
      }
      if (player.turnsRemaining < 5) return false;
      if (!noBudget && spent + 5 > budgetCeiling) return false;

      if (dryRun) {
        spent += 5;
        stats.recruitsCycles += 1;
        player = {
          ...player,
          turnsRemaining: player.turnsRemaining - 5,
          stats: { ...player.stats, unitsAlive: player.stats.unitsAlive + 10 },
        };
        const src = myMilitary.find((t) => t.tileId === tileId);
        if (src) src.units = { ...src.units, [unitType]: src.units[unitType] + 10 };
        return true;
      }

      try {
        const r = await bulkBuildUnitsServer(
          uid,
          [{ tileId, unitType, cycles: 1 }],
          now
        );
        player = r.player;
        spent += 5;
        stats.recruitsCycles += 1;
        if (r.stoppedEarly) {
          if (!(await plantFoodTile())) return false;
          continue;
        }
        return true;
      } catch (e) {
        const msg = (e as Error).message;
        if (msg.toLowerCase().includes("cap")) {
          if (!(await plantFoodTile())) return false;
          continue;
        }
        return false;
      }
    }
    return false;
  }

  async function plantMilitaryBase(): Promise<string | null> {
    if (player.turnsRemaining < 3) return null;
    if (!noBudget && spent + 3 > budgetCeiling) return null;
    if (dryRun) {
      spent += 3;
      stats.expansions += 1;
      player = { ...player, turnsRemaining: player.turnsRemaining - 3 };
      // Local-only fake — no neighbors, won't generate dry-run candidates.
      // Apply mode gets a real neighbor list from the server.
      const fakeId = `dry-${uid}-${stats.expansions}`;
      const fakeTile: GameTile = {
        tileId: fakeId,
        q: 0,
        r: 0,
        ownerId: uid,
        type: "military",
        level: 0,
        units: { ground: 0, siege: 0, air: 0 },
        armedDefenseSpellId: null,
        neighborTileIds: [],
        upgradeIds: [],
        isolatedSpawn: true,
        revealedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      myTiles.push(fakeTile);
      myMilitary.push(fakeTile);
      return fakeId;
    }
    try {
      const fxR = await farExpeditionExploreServer(uid, now);
      player = fxR.player;
      spent += FAR_EXPEDITION_TURN_COST;
      stats.expansions += 1;
      const id = fxR.tile.tileId;
      world.tilesById.set(id, fxR.tile);
      if (fxR.enemyTile) world.tilesById.set(fxR.enemyTile.tileId, fxR.enemyTile);
      const dR = await distributeTileServer(uid, id, "military", now);
      player = dR.player;
      spent += 1;
      world.tilesById.set(id, dR.tile);
      return id;
    } catch {
      return null;
    }
  }

  async function refreshLocal(): Promise<void> {
    myTiles = await refreshMyTiles(db, uid);
    myMilitary = myTiles.filter((t) => t.type === "military");
    myFood = myTiles.filter((t) => t.type === "food").length;
    myMagic = myTiles.filter((t) => t.type === "magic").length;
  }

  while (player.turnsRemaining >= 1 && iter < maxIters && (noBudget || spent < budgetCeiling)) {
    iter += 1;
    const candidates = findAttackCandidates(uid, myMilitary, world, now)
      .map((c) => ({ c, s: scoreCandidate(c, persona) }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);

    if (candidates.length > 0) {
      const picked = candidates[0]!;
      const send = pickUnitsToSend(picked.sourceUnits, persona, picked.targetCapacity);
      if (sumStack(send) === 0) {
        // Couldn't deploy from this source — drop it and re-search.
        myMilitary = myMilitary.filter((t) => t.tileId !== picked.sourceTileId);
        continue;
      }

      if (dryRun) {
        // Local-only sim: deduct sent units so the next iteration doesn't
        // re-pick the same source forever. Outcomes are stochastic in real
        // play so we don't try to predict them here.
        spent += 1;
        stats.attacks += 1;
        const src = myMilitary.find((t) => t.tileId === picked.sourceTileId);
        if (src) {
          src.units = {
            ground: src.units.ground - send.ground,
            siege: src.units.siege - send.siege,
            air: src.units.air - send.air,
          };
        }
        player = { ...player, turnsRemaining: player.turnsRemaining - 1 };
        continue;
      }

      try {
        const r = await attackTileServer({
          attackerId: uid,
          sourceTileId: picked.sourceTileId,
          targetTileId: picked.targetTileId,
          units: send,
          offenseSpellId: null,
          now,
        });
        player = r.attackerPlayer;
        spent += 1;
        stats.attacks += 1;
        if (r.attack.outcome === "captured") stats.captured += 1;
        else if (r.attack.outcome === "repelled") stats.repelled += 1;
        else if (r.attack.outcome === "stalemate") stats.stalemate += 1;

        const src = myMilitary.find((t) => t.tileId === picked.sourceTileId);
        if (src) src.units = r.sourceTile.units;

        // Always patch the world's tile cache so further candidate searches
        // (this NPC's later iterations, and the next NPC's run) see the
        // post-attack ownership + unit counts.
        world.tilesById.set(r.targetTile.tileId, r.targetTile);
        world.tilesById.set(r.sourceTile.tileId, r.sourceTile);
        if (r.attack.outcome === "captured") {
          myTiles.push(r.targetTile);
          if (r.targetTile.type === "military") myMilitary.push(r.targetTile);
          if (r.targetTile.type === "food") myFood += 1;
          if (r.targetTile.type === "magic") myMagic += 1;
        }
      } catch (e) {
        console.error(`  attack failed (${uid}): ${(e as Error).message}`);
        // Drop the source so we don't loop on a persistent server-side reject.
        myMilitary = myMilitary.filter((t) => t.tileId !== picked.sourceTileId);
      }
      continue;
    }

    // No attack candidates this iteration. Try in order:
    //   (a) Recruit on an under-armed bordering tile (with food fallback).
    //   (b) Plant a forward base via far-exp, recruit on it (with food
    //       fallback). Only in --expand mode.
    const hasEnemyNeighbor = (t: GameTile): boolean =>
      t.neighborTileIds.some((nid) => {
        const tt = world.tilesById.get(nid);
        return tt !== undefined && tt.ownerId !== undefined && tt.ownerId !== uid;
      });
    const bordering = myMilitary.filter(hasEnemyNeighbor);
    const underArmed = bordering.filter((t) => sumStack(t.units) < 5);

    if (underArmed.length > 0) {
      // Pick the under-armed bordering tile touching the most enemies — one
      // recruit cycle unlocks the broadest attack surface.
      const enemyNeighborCount = (t: GameTile): number =>
        t.neighborTileIds.filter((n) => {
          const tt = world.tilesById.get(n);
          return tt !== undefined && tt.ownerId !== undefined && tt.ownerId !== uid;
        }).length;
      underArmed.sort((a, b) => enemyNeighborCount(b) - enemyNeighborCount(a));
      const buildOn = underArmed[0]!;
      const unitType: UnitType = persona.preferredUnit ?? "ground";
      const ok = await recruitWithFoodFallback(buildOn.tileId, unitType);
      if (ok) {
        if (!dryRun) await refreshLocal();
        continue;
      }
      // Recruit unrecoverable on this tile (out of turns, non-cap error,
      // or food retries exhausted). In --expand mode, fall through to far-exp
      // for a fresh attack vector. Otherwise bail.
      if (!expand) {
        stats.bailReason = "recruit failed (cap+food or turns)";
        break;
      }
    }

    if (!expand) {
      // Blitz mode without --expand: there's a bordering tile (≥5 units) but
      // every candidate is filtered (shielded / full), OR there are no
      // bordering tiles at all. Nothing more we can do here.
      stats.bailReason =
        bordering.length === 0 ? "no enemy borders" : "borders shielded/full";
      break;
    }

    // --expand: plant a forward military base next to a new opponent,
    // recruit (with food fallback), and loop so next iter attacks from it.
    const newTileId = await plantMilitaryBase();
    if (newTileId === null) {
      stats.bailReason = "expand failed (frontier/no-enemies/out of turns)";
      break;
    }
    const ok = await recruitWithFoodFallback(
      newTileId,
      persona.preferredUnit ?? "ground"
    );
    if (!ok) {
      stats.bailReason = "expand recruit failed";
      break;
    }
    if (!dryRun) await refreshLocal();
  }

  if (!stats.bailReason) {
    if (!noBudget && spent >= budgetCeiling) stats.bailReason = "budget exhausted";
    else if (iter >= maxIters) stats.bailReason = "iter cap";
    else if (player.turnsRemaining < 1) stats.bailReason = "no turns";
  }
  stats.turnsAfter = player.turnsRemaining;
  return stats;
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const expand = process.argv.includes("--expand");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg
    ? Number.parseInt(limitArg.slice("--limit=".length), 10)
    : null;
  const dryRun = !apply;
  // Per-invocation spending cap.
  //   blitz: 50 turns / NPC (the granted bonus — don't drain pre-existing turns).
  //   expand: no cap. runOneNpc drains the NPC's full bucket until truly stuck
  //   (no candidates, no recruit possible even with food, no expand possible).
  const budgetCeiling = TURNS_GRANTED; // only consulted in blitz mode

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  console.log(
    `[npc-blitz] mode=${dryRun ? "DRY-RUN" : "APPLY"} ` +
      `${expand ? "expand=ON (skip grant, process all NPCs, far-exp fallback) " : `grant=+${TURNS_GRANTED} stamp=${GRANT_STAMP_FIELD}=${GRANT_KEY} `}` +
      `limit=${limit ?? "all"}`
  );

  const world = await loadWorld(db);
  const npcCount = [...world.isNpc.values()].filter(Boolean).length;
  console.log(
    `[npc-blitz] Loaded ${npcCount} NPC(s) and ${world.allPlayers.size - npcCount} human player(s).`
  );

  // Eligibility:
  //   - blitz mode: NPCs not already stamped with this GRANT_KEY (idempotent grant).
  //   - expand mode: every NPC (we're spending banked turns, not granting new ones).
  const eligibleUids: string[] = [];
  let alreadyGranted = 0;
  for (const [uid, p] of world.allPlayers) {
    if (!world.isNpc.get(uid)) continue;
    if (!expand) {
      const stamp = (p as unknown as Record<string, unknown>)[GRANT_STAMP_FIELD];
      if (stamp === GRANT_KEY) {
        alreadyGranted += 1;
        continue;
      }
    }
    eligibleUids.push(uid);
  }
  if (limit !== null) eligibleUids.splice(limit);
  console.log(
    `[npc-blitz] Eligible: ${eligibleUids.length}` +
      (expand ? "" : `, already granted: ${alreadyGranted}.`)
  );

  // Phase 1: grant +50 turns (idempotent). Skipped entirely in --expand mode.
  const turnsBeforeByUid = new Map<string, number>();
  for (const uid of eligibleUids) {
    const p = world.allPlayers.get(uid)!;
    turnsBeforeByUid.set(uid, p.turnsRemaining);
    if (!expand) {
      world.allPlayers.set(uid, {
        ...p,
        turnsRemaining: p.turnsRemaining + TURNS_GRANTED,
      });
    }
  }
  if (!expand) {
    if (!dryRun) {
      for (const uid of eligibleUids) {
        await db
          .collection(PLAYERS)
          .doc(uid)
          .update({
            turnsRemaining: FieldValue.increment(TURNS_GRANTED),
            [GRANT_STAMP_FIELD]: GRANT_KEY,
            updatedAt: FieldValue.serverTimestamp(),
          });
      }
      console.log(`[npc-blitz] Granted +${TURNS_GRANTED} to ${eligibleUids.length} NPC(s).`);
    } else {
      console.log(`[npc-blitz] (dry-run) Would grant +${TURNS_GRANTED} to ${eligibleUids.length} NPC(s).`);
    }
  }

  // Phase 2: per-NPC attack-first loop.
  const allStats: NpcStats[] = [];
  const now = new Date();
  for (const uid of eligibleUids) {
    const p = world.allPlayers.get(uid)!;
    const personaName = personaNameForUid(uid);
    process.stdout.write(`[npc-blitz] ${p.displayName} (${personaName}, ${p.caste ?? "—"}) ... `);
    const s = await runOneNpc({
      db,
      player: p,
      turnsBefore: turnsBeforeByUid.get(uid) ?? p.turnsRemaining - (expand ? 0 : TURNS_GRANTED),
      world,
      dryRun,
      now,
      personaName,
      expand,
      budgetCeiling,
    });
    allStats.push(s);
    console.log(
      `att=${s.attacks} (cap=${s.captured}/rep=${s.repelled}/sta=${s.stalemate}) ` +
        `exp=${s.expansions} rec=${s.recruitsCycles} ` +
        `turns ${s.turnsBefore}→${s.turnsAfter} bail=${s.bailReason ?? "ok"}`
    );
  }

  // Phase 3: rebuild world snapshot if we wrote anything (tiles changed
  // ownership, units shifted — the cached snapshot is now stale).
  const wroteSomething = allStats.some(
    (s) => s.attacks > 0 || s.recruitsCycles > 0 || s.expansions > 0
  );
  if (!dryRun && wroteSomething) {
    console.log("[npc-blitz] Rebuilding world snapshot...");
    const r = await rebuildWorldSnapshotServer(now, { force: true });
    console.log(
      `[npc-blitz] Snapshot: tiles=${r.tileCount} owners=${r.ownerCount} bytes=${r.bytes}`
    );
  }

  const totals = allStats.reduce(
    (a, s) => ({
      attacks: a.attacks + s.attacks,
      captured: a.captured + s.captured,
      repelled: a.repelled + s.repelled,
      stalemate: a.stalemate + s.stalemate,
      expansions: a.expansions + s.expansions,
      recruits: a.recruits + s.recruitsCycles,
    }),
    { attacks: 0, captured: 0, repelled: 0, stalemate: 0, expansions: 0, recruits: 0 }
  );
  console.log(
    `\n[npc-blitz] Done${dryRun ? " (DRY-RUN, no writes)" : ""}. ` +
      `npcs=${eligibleUids.length} attacks=${totals.attacks} ` +
      `(captured=${totals.captured}, repelled=${totals.repelled}, stalemate=${totals.stalemate}) ` +
      `expansions=${totals.expansions} recruit-cycles=${totals.recruits}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
