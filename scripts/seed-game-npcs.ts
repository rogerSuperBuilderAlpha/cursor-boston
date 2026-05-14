#!/usr/bin/env node
/**
 * Seeds N synthetic "NPC" players with end-state values that look like they've
 * played ~300 turns each:
 *   - random caste, distribution mix, troop composition
 *   - 25–80 owned tiles spawned via the same hex-spiral helper used by setup
 *   - units stocked on military tiles, clamped to per-tile capacity and the
 *     player-wide food-derived unit cap
 *   - 1–2 active caste upgrades for variety
 *   - phase: "play", caste set, casteLockedAt now, shield expired (turnsSpent
 *     >= SHIELD_TURN_THRESHOLD)
 *
 * NOT a faithful turn-by-turn simulation — it writes terminal state directly.
 * Runs against whatever Firestore the env points at; idempotent insofar as it
 * uses fresh uuids per NPC, so reruns just add more NPCs.
 *
 * Usage:
 *   npx tsx scripts/seed-game-npcs.ts [count]    # default 50
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { randomUUID } from "node:crypto";
import type { Firestore, WriteBatch } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { ALL_UPGRADES } from "../lib/game/content";
import {
  computeTileCapacity,
  makeSeededRng,
  unitCapFromFoodLands,
} from "../lib/game/combat";
import {
  SHIELD_DURATION_WEEKS,
  SHIELD_TURN_THRESHOLD,
} from "../lib/game/turns";
import {
  axialFromTileId,
  neighborTileIds,
  spawnCenterForPlayerIndex,
  spawnPlayerLands,
  tileIdFromAxial,
} from "../lib/game/world-gen";
import type {
  Caste,
  GamePlayer,
  GameTile,
  LandType,
  UnitStack,
  UnitType,
} from "../lib/game/types";

const COLLECTIONS = {
  PLAYERS: "game_players",
  TILES: "game_tiles",
  WORLD_META: "game_world_meta",
} as const;
const WORLD_META_DOC = "singleton";

const CASTES: Caste[] = ["black", "red", "white", "green", "blue"];

// 60 fantasy general names; we slice a unique one per NPC and append " ##"
// for any past index 60 to stay under the 32-char general-name limit while
// guaranteeing displayNameLower uniqueness.
const NAME_POOL = [
  "Aurelius the Bold", "Magna Carthos", "Lord Veil", "Vexa Stormcaller",
  "Ironclaw Drun", "Sable Maro", "Captain Idriel", "General Tovak",
  "Nyx Brightblade", "Halric the Patient", "Dame Orla", "Kestrel Vale",
  "Mordan Greycloak", "Pyra Ashwright", "Yorick Stoneheart", "Lirien Dawnstrike",
  "Khorvath", "Thessia Zenrunner", "Bram Hollowwind", "Selene Ironvein",
  "Drogath the Iron", "Mara Vellis", "Caspian Starwatch", "Edda Brightspear",
  "Faolan Brae", "Garven Thrune", "Hessa Quickflame", "Ivar the Quiet",
  "Joren Sablebrook", "Kael Vornn", "Lysa Marchwarden", "Mira Tindalewright",
  "Nereus Coldforge", "Othric Vael", "Petra Mossguard", "Quill Aldecroft",
  "Roen Skywatcher", "Sirin Vox", "Talia Nethermoor", "Ulric Stormhand",
  "Vesper Glade", "Wystan Ferndale", "Xanthe Brightthorn", "Yael Ashenroot",
  "Zara Hexblade", "Eos Ravenshade", "Bellweather Tor", "Cyran the Silent",
  "Dunric Bramble", "Eira Loomwhisper", "Faldric Vex", "Gisla Thornveil",
  "Halen Pyrewright", "Indra Cloudglen", "Joss the Veiled", "Kira Ravenwood",
  "Lothan Mossbright", "Mern Stormhollow", "Nilani Tide", "Orin the Frost",
];

interface Strategy {
  name: string;
  // Target distribution of revealed tiles between military / food / magic.
  // Must sum to 1; small remainder goes to "unassigned".
  mil: number;
  food: number;
  magic: number;
  // Target unit composition (sums to 1).
  ground: number;
  siege: number;
  air: number;
}

const STRATEGIES: Strategy[] = [
  { name: "war machine", mil: 0.55, food: 0.25, magic: 0.20, ground: 0.5, siege: 0.3, air: 0.2 },
  { name: "balanced", mil: 0.35, food: 0.40, magic: 0.25, ground: 0.34, siege: 0.33, air: 0.33 },
  { name: "magic-focused", mil: 0.25, food: 0.35, magic: 0.40, ground: 0.3, siege: 0.2, air: 0.5 },
  { name: "food-rich", mil: 0.30, food: 0.55, magic: 0.15, ground: 0.5, siege: 0.25, air: 0.25 },
  { name: "ground-rusher", mil: 0.50, food: 0.35, magic: 0.15, ground: 0.8, siege: 0.1, air: 0.1 },
  { name: "siege-master", mil: 0.45, food: 0.35, magic: 0.20, ground: 0.15, siege: 0.7, air: 0.15 },
  { name: "air-superior", mil: 0.45, food: 0.30, magic: 0.25, ground: 0.15, siege: 0.15, air: 0.7 },
  { name: "fortress", mil: 0.35, food: 0.30, magic: 0.35, ground: 0.4, siege: 0.4, air: 0.2 },
];

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

// Distribute `total` items across `count` buckets according to weights, using
// largest-remainder rounding so the totals are exact. Each bucket is at least 0.
function distributeByWeights(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const floored = raw.map((x) => Math.floor(x));
  let allocated = floored.reduce((a, b) => a + b, 0);
  const remainders = raw.map((x, i) => ({ i, frac: x - Math.floor(x) }));
  remainders.sort((a, b) => b.frac - a.frac);
  let k = 0;
  while (allocated < total) {
    floored[remainders[k % remainders.length]!.i]! += 1;
    allocated += 1;
    k += 1;
  }
  return floored;
}

function npcDisplayName(index: number): string {
  if (index < NAME_POOL.length) return NAME_POOL[index]!;
  // Wrap around with a numeric suffix; max known length 24 + " 99" = 27 ≤ 32.
  const base = NAME_POOL[index % NAME_POOL.length]!;
  return `${base} ${Math.floor(index / NAME_POOL.length) + 1}`;
}

function chooseUpgradesForCaste(
  caste: Caste,
  rng: () => number,
  count: number
): Record<string, string> {
  const candidates = ALL_UPGRADES.filter((u) => u.caste === caste);
  const out: Record<string, string> = {};
  // Shuffle candidates and take up to `count` non-conflicting ones (one per
  // targetId). Effectively random subset.
  const shuffled = [...candidates].sort(() => rng() - 0.5);
  for (const u of shuffled) {
    if (out[u.targetId]) continue;
    out[u.targetId] = u.id;
    if (Object.keys(out).length >= count) break;
  }
  return out;
}

interface SpawnedPlayer {
  uid: string;
  player: GamePlayer;
  tiles: GameTile[];
}

function buildNpc(args: {
  index: number;
  spawnIndex: number;
  claimedTileIds: Set<string>;
  now: Date;
  rng: () => number;
}): SpawnedPlayer {
  const { index, spawnIndex, claimedTileIds, now, rng } = args;
  const caste = pick(rng, CASTES);
  const strategy = pick(rng, STRATEGIES);
  // Tile size variety: 25 (fresh-spawn) to 80 (assumed to have captured tiles).
  const tilesTotal = 25 + Math.floor(rng() * 56);

  const center = spawnCenterForPlayerIndex(spawnIndex);
  const spawn = spawnPlayerLands({
    center,
    claimedTileIds,
    rng,
    totalTiles: tilesTotal,
    contiguousTarget: Math.max(20, Math.floor(tilesTotal * 0.8)),
    exclavesMin: 3,
    exclavesMax: 5,
  });

  // Distribute land types.
  const mil = Math.round(tilesTotal * strategy.mil);
  const food = Math.round(tilesTotal * strategy.food);
  const magic = Math.round(tilesTotal * strategy.magic);
  // Any remainder lands in "unassigned" (the player chose not to commit yet).
  const used = mil + food + magic;
  const unassigned = Math.max(0, tilesTotal - used);
  // If used > tilesTotal due to rounding, trim from the smallest bucket.
  let m = mil, f = food, g = magic;
  if (used > tilesTotal) {
    const overflow = used - tilesTotal;
    const buckets: { key: "m" | "f" | "g"; n: number }[] = [
      { key: "m", n: m }, { key: "f", n: f }, { key: "g", n: g },
    ];
    buckets.sort((a, b) => a.n - b.n);
    let left = overflow;
    for (const b of buckets) {
      const take = Math.min(b.n, left);
      if (b.key === "m") m -= take;
      if (b.key === "f") f -= take;
      if (b.key === "g") g -= take;
      left -= take;
      if (left === 0) break;
    }
  }

  // Shuffle tile order so type assignment is not spatially uniform.
  const shuffledTiles = [...spawn.tileIds].sort(() => rng() - 0.5);
  const types: LandType[] = [];
  for (let i = 0; i < m; i++) types.push("military");
  for (let i = 0; i < f; i++) types.push("food");
  for (let i = 0; i < g; i++) types.push("magic");
  for (let i = 0; i < unassigned; i++) types.push("unassigned");
  while (types.length < shuffledTiles.length) types.push("unassigned");

  const activeUpgrades = chooseUpgradesForCaste(
    caste,
    rng,
    1 + Math.floor(rng() * 2)
  );

  // Compute unit cap and per-tile capacity.
  const foodCount = f;
  const unitCap = unitCapFromFoodLands(foodCount);
  // Apply caste bonuses to a target unit count: NPCs aim for 70–100% of cap so
  // not every general is fully maxed.
  const fillFactor = 0.7 + rng() * 0.3;
  const targetUnits = Math.floor(unitCap * fillFactor);
  // Compose unit type counts.
  const composition = distributeByWeights(targetUnits, [
    strategy.ground, strategy.siege, strategy.air,
  ]);
  let groundLeft = composition[0]!;
  let siegeLeft = composition[1]!;
  let airLeft = composition[2]!;
  // Caste's tile capacity for military land.
  const milCapPerTile = computeTileCapacity(
    "military",
    caste,
    [],
    activeUpgrades
  );

  const uid = `npc-${String(index).padStart(3, "0")}-${randomUUID().slice(0, 8)}`;

  const tiles: GameTile[] = shuffledTiles.map((tileId, i) => {
    const { q, r } = axialFromTileId(tileId);
    const type = types[i]!;
    const units: UnitStack = { ground: 0, siege: 0, air: 0 };
    if (type === "military") {
      let space = milCapPerTile;
      // Allocate units onto this tile, preferring the bigger remaining buckets.
      const order: { kind: UnitType; remaining: () => number }[] = (
        [
          { kind: "ground" as UnitType, remaining: () => groundLeft },
          { kind: "siege" as UnitType, remaining: () => siegeLeft },
          { kind: "air" as UnitType, remaining: () => airLeft },
        ]
      ).sort((a, b) => b.remaining() - a.remaining());
      for (const slot of order) {
        if (space <= 0) break;
        const take = Math.min(space, slot.remaining());
        if (take <= 0) continue;
        units[slot.kind] = take;
        if (slot.kind === "ground") groundLeft -= take;
        if (slot.kind === "siege") siegeLeft -= take;
        if (slot.kind === "air") airLeft -= take;
        space -= take;
      }
    }
    return {
      tileId,
      q,
      r,
      ownerId: uid,
      type,
      level: 0,
      units,
      armedDefenseSpellId: null,
      neighborTileIds: neighborTileIds(q, r),
      upgradeIds: [],
      revealedAt: now,
      createdAt: now,
      updatedAt: now,
    };
  });

  // Mark every spawned tile as claimed so subsequent NPC spawns avoid them.
  for (const t of tiles) claimedTileIds.add(t.tileId);

  // Compute final unitsAlive after fitting.
  const unitsAlive = tiles.reduce(
    (sum, t) => sum + t.units.ground + t.units.siege + t.units.air,
    0
  );

  // Shield: turnsSpentTotal >= SHIELD_TURN_THRESHOLD drops the shield via
  // isShieldActive(), regardless of shieldUntil. We still set shieldUntil to
  // the past so any UI showing the date is consistent.
  const shieldUntil = new Date(
    now.getTime() - SHIELD_DURATION_WEEKS * 7 * 24 * 60 * 60 * 1000
  );

  // Vary win/loss counts a bit (purely cosmetic on the leaderboard).
  const attacksWon = Math.floor(rng() * 12);
  const attacksLost = Math.floor(rng() * 8);

  const player: GamePlayer & {
    displayNameLower: string;
    isNpc: boolean;
  } = {
    userId: uid,
    displayName: npcDisplayName(index),
    caste,
    casteLockedAt: now,
    turnsRemaining: Math.floor(rng() * 80), // 0–79 leftover from the bucket
    turnsSpentTotal: 300,
    phase: "play",
    tilesExplored: tilesTotal,
    shieldUntil,
    shieldDropAtTurn: SHIELD_TURN_THRESHOLD,
    productionSpellsActive: [],
    activeUpgrades,
    stats: {
      attacksWon,
      attacksLost,
      tilesHeld: tilesTotal,
      unitsAlive,
    },
    createdAt: now,
    updatedAt: now,
    // Extra fields stored alongside but not on the GamePlayer type.
    displayNameLower: npcDisplayName(index).toLowerCase(),
    isNpc: true,
  };

  return { uid, player, tiles };
}

async function commitPlayer(
  db: Firestore,
  player: SpawnedPlayer
): Promise<void> {
  const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(player.uid);
  // Use sub-batches; tiles can run 80+ which is well under the 500 op limit
  // but we batch separately from the player doc for clarity.
  await playerRef.set(player.player as GamePlayer);
  const BATCH_LIMIT = 400;
  let batch: WriteBatch = db.batch();
  let inBatch = 0;
  for (const tile of player.tiles) {
    const ref = db.collection(COLLECTIONS.TILES).doc(tile.tileId);
    batch.set(ref, tile);
    inBatch += 1;
    if (inBatch >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();
}

async function loadClaimedTiles(db: Firestore): Promise<Set<string>> {
  const snap = await db.collection(COLLECTIONS.TILES).get();
  const set = new Set<string>();
  for (const d of snap.docs) set.add(d.id);
  return set;
}

async function loadExistingNames(db: Firestore): Promise<Set<string>> {
  const snap = await db.collection(COLLECTIONS.PLAYERS).get();
  const set = new Set<string>();
  for (const d of snap.docs) {
    const p = d.data();
    if (typeof p.displayNameLower === "string") set.add(p.displayNameLower);
    else if (typeof p.displayName === "string" && p.displayName)
      set.add(p.displayName.toLowerCase());
  }
  return set;
}

async function main() {
  const count = Number.parseInt(process.argv[2] ?? "50", 10);
  if (!Number.isFinite(count) || count <= 0) {
    console.error("Usage: npx tsx scripts/seed-game-npcs.ts [count]");
    process.exit(1);
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  const metaRef = db.collection(COLLECTIONS.WORLD_META).doc(WORLD_META_DOC);
  const metaSnap = await metaRef.get();
  const startingPlayerCount =
    (metaSnap.data()?.playerCount as number | undefined) ?? 0;

  console.log(
    `[seed-npcs] starting; world playerCount=${startingPlayerCount}, target ${count} NPCs`
  );

  const claimedTileIds = await loadClaimedTiles(db);
  const existingNames = await loadExistingNames(db);
  console.log(
    `[seed-npcs] loaded ${claimedTileIds.size} existing tiles, ${existingNames.size} existing names`
  );

  const now = new Date();
  const masterRng = makeSeededRng(`npc-seed-${now.getTime()}`);

  let spawnIndex = startingPlayerCount;
  const summary: Array<{
    uid: string;
    name: string;
    caste: Caste;
    tiles: number;
    units: number;
  }> = [];

  for (let i = 0; i < count; i++) {
    // Skip names already in use (rare; pool has 60 unique).
    let nameIndex = i;
    let candidateName = npcDisplayName(nameIndex);
    let safety = 0;
    while (existingNames.has(candidateName.toLowerCase()) && safety < 200) {
      nameIndex += 1;
      candidateName = npcDisplayName(nameIndex);
      safety += 1;
    }
    existingNames.add(candidateName.toLowerCase());

    // Walk forward until we land on a non-collision spawn center, like the
    // setup-new-player retry loop. Up to 32 tries per NPC.
    let spawned: SpawnedPlayer | null = null;
    let tries = 0;
    while (!spawned && tries < 32) {
      const center = spawnCenterForPlayerIndex(spawnIndex);
      const candidateCenterId = tileIdFromAxial(center.q, center.r);
      if (claimedTileIds.has(candidateCenterId)) {
        spawnIndex += 1;
        tries += 1;
        continue;
      }
      try {
        spawned = buildNpc({
          index: nameIndex,
          spawnIndex,
          claimedTileIds,
          now,
          rng: masterRng,
        });
      } catch (e) {
        console.warn(
          `[seed-npcs] spawn at index ${spawnIndex} failed: ${(e as Error).message}; retrying`
        );
        spawnIndex += 1;
        tries += 1;
      }
    }
    if (!spawned) {
      console.error(`[seed-npcs] failed to place NPC ${i + 1}; aborting`);
      process.exit(1);
    }

    // Override the NPC's name with the resolved candidate (in case we
    // bumped past pool collisions above).
    spawned.player.displayName = candidateName;
    (spawned.player as unknown as { displayNameLower: string }).displayNameLower =
      candidateName.toLowerCase();

    await commitPlayer(db, spawned);
    summary.push({
      uid: spawned.uid,
      name: spawned.player.displayName,
      caste: spawned.player.caste!,
      tiles: spawned.player.stats.tilesHeld,
      units: spawned.player.stats.unitsAlive,
    });
    console.log(
      `[seed-npcs] (${i + 1}/${count}) ${candidateName} [${spawned.player.caste}] tiles=${spawned.player.stats.tilesHeld} units=${spawned.player.stats.unitsAlive} spawnIdx=${spawnIndex}`
    );
    spawnIndex += 1;
  }

  // Bump world_meta.playerCount so future setups skip past the slots we used.
  await metaRef.set(
    {
      playerCount: spawnIndex,
      lastSpawnAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  // Summary stats.
  const byCaste: Record<string, number> = {};
  for (const s of summary) byCaste[s.caste] = (byCaste[s.caste] ?? 0) + 1;
  const totalUnits = summary.reduce((a, b) => a + b.units, 0);
  const totalTiles = summary.reduce((a, b) => a + b.tiles, 0);
  console.log(
    `\n[seed-npcs] Done. Created ${summary.length} NPCs.`
  );
  console.log(`  Caste counts: ${JSON.stringify(byCaste)}`);
  console.log(`  Total tiles: ${totalTiles}, total units: ${totalUnits}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
