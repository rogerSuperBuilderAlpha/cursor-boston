/**
 * Shared Firestore stubs for data-server mutation tests.
 */
import { neighborTileIds } from "@/lib/game/world-gen";

export type TxSnapshots = {
  tile?: { exists: boolean; data?: Record<string, unknown> };
  player?: { exists: boolean; data?: Record<string, unknown> };
};

export function buildGameMutationDb(opts: TxSnapshots & {
  ownedTileDocs?: Array<{ id: string; data: Record<string, unknown> }>;
  unrevealedDocs?: Array<{ id: string; data: Record<string, unknown> }>;
}) {
  const tileRef = { __kind: "tile" as const };
  const playerRef = { __kind: "player" as const };

  const tileSnap = {
    exists: opts.tile?.exists ?? false,
    data: () => opts.tile?.data,
    id: "t1",
  };
  const playerSnap = {
    exists: opts.player?.exists ?? false,
    data: () => opts.player?.data,
    id: "u1",
  };

  const ownedDocs = (opts.ownedTileDocs ?? []).map((d) => ({
    id: d.id,
    data: () => d.data,
    exists: true,
  }));

  const unrevealedDocs = (opts.unrevealedDocs ?? []).map((d) => ({
    id: d.id,
    data: () => d.data,
    exists: true,
  }));

  const tx = {
    get: jest.fn((ref: { __kind?: string }) => {
      if (ref === tileRef) return Promise.resolve(tileSnap);
      if (ref === playerRef) return Promise.resolve(playerSnap);
      return Promise.resolve({ exists: false, data: () => undefined });
    }),
    update: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  };

  const tilesCollection = {
    doc: jest.fn((_id?: string) => tileRef),
    where: jest.fn((field: string, op: string, value: unknown) => {
      if (field === "ownerId" && value === "u1") {
        return {
          where: jest.fn((f2: string, op2?: string) => {
            if (f2 === "type" && (op2 === "in" || op2 === "==")) {
              return {
                get: jest.fn().mockResolvedValue({ docs: ownedDocs }),
                limit: jest.fn().mockReturnValue({
                  get: jest.fn().mockResolvedValue({
                    empty: unrevealedDocs.length === 0,
                    docs: unrevealedDocs,
                  }),
                }),
              };
            }
            return { get: jest.fn().mockResolvedValue({ docs: [] }) };
          }),
          get: jest.fn().mockResolvedValue({ docs: ownedDocs }),
        };
      }
      return {
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
          }),
          get: jest.fn().mockResolvedValue({ docs: [] }),
        }),
      };
    }),
  };

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_tiles") return tilesCollection;
      if (name === "game_players") return { doc: jest.fn(() => playerRef) };
      return { doc: jest.fn(), where: jest.fn() };
    }),
    runTransaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  return { db, tx, tileRef, playerRef };
}

export const BASE_PLAYER = {
  userId: "u1",
  phase: "play",
  turnsRemaining: 10,
  turnsSpentTotal: 5,
  caste: "red" as const,
  stats: { unitsAlive: 0, tilesHeld: 1000 },
  tilesExplored: 50,
  productionSpellsActive: [] as Array<{ spellId: string; expiresAtTurn: number }>,
};

export const BASE_TILE = {
  tileId: "t1",
  ownerId: "u1",
  type: "military" as const,
  q: 0,
  r: 0,
  units: { ground: 0, air: 0, siege: 0 },
};

const EMPTY_QUERY = { empty: true, docs: [] as Array<{ id: string; data: () => unknown }> };

function pactsCollection() {
  const chain = {
    where: jest.fn(() => chain),
    get: jest.fn().mockResolvedValue(EMPTY_QUERY),
  };
  return { where: jest.fn(() => chain), doc: jest.fn(() => ({})) };
}

type DocRef = { __kind: string; id: string };

function docWithGet(
  ref: DocRef,
  resolveSnap: (ref: DocRef) => { exists: boolean; data: () => unknown; id: string },
) {
  return {
    ...ref,
    get: jest.fn(() => Promise.resolve(resolveSnap(ref))),
  };
}

/**
 * Firestore stub for attack / cast-spell / flyover / preview mutations:
 * pre-read `.get()` on tile/player docs, txn reads on attacker/defender/source/target,
 * neighbor `tx.get` loops, empty pacts query, and owned-tile `type in` queries.
 */
export function buildCombatMutationDb(opts: {
  attackerId?: string;
  defenderId?: string;
  sourceTileId?: string;
  targetTileId?: string;
  attacker: Record<string, unknown>;
  defender: Record<string, unknown>;
  source: Record<string, unknown>;
  target: Record<string, unknown>;
  ownedTileDocs?: Array<{ id: string; data: Record<string, unknown> }>;
}) {
  const attackerId = opts.attackerId ?? "u1";
  const defenderId = opts.defenderId ?? "u2";
  const sourceTileId = opts.sourceTileId ?? "0_0";
  const targetTileId = opts.targetTileId ?? "1_0";

  const attackerRef: DocRef = { __kind: "attacker", id: attackerId };
  const defenderRef: DocRef = { __kind: "defender", id: defenderId };
  const sourceRef: DocRef = { __kind: "source", id: sourceTileId };
  const targetRef: DocRef = { __kind: "target", id: targetTileId };

  const snap = (data: Record<string, unknown>, id: string) => ({
    exists: true as const,
    data: () => data,
    id,
  });
  const missingSnap = {
    exists: false as const,
    data: () => undefined,
    id: "",
  };

  const attackerSnap = snap(opts.attacker, attackerId);
  const defenderSnap = snap(opts.defender, defenderId);
  const sourceSnap = snap(opts.source, sourceTileId);
  const targetSnap = snap(opts.target, targetTileId);

  const sourceQ = (opts.source.q as number) ?? 0;
  const sourceR = (opts.source.r as number) ?? 0;
  const neighborSnapsById = new Map<string, ReturnType<typeof snap> | typeof missingSnap>();
  for (const nid of neighborTileIds(sourceQ, sourceR)) {
    neighborSnapsById.set(nid, missingSnap);
  }
  neighborSnapsById.set(targetTileId, targetSnap);

  const ownedDocs = (opts.ownedTileDocs ?? []).map((d) => ({
    id: d.id,
    data: () => d.data,
    exists: true,
  }));

  const neighborRefs = new Map<string, DocRef>();
  for (const nid of neighborTileIds(sourceQ, sourceR)) {
    neighborRefs.set(nid, { __kind: "neighbor", id: nid });
  }

  const resolveSnap = (ref: { __kind?: string; id?: string }) => {
    if (ref.id === attackerId && ref.__kind === "attacker") return attackerSnap;
    if (ref.id === defenderId && ref.__kind === "defender") return defenderSnap;
    if (ref.id === sourceTileId && ref.__kind === "source") return sourceSnap;
    if (ref.id === targetTileId && ref.__kind === "target") return targetSnap;
    if (ref.__kind === "neighbor" && ref.id) {
      return neighborSnapsById.get(ref.id) ?? missingSnap;
    }
    return missingSnap;
  };

  const attackerDoc = docWithGet(attackerRef, resolveSnap);
  const defenderDoc = docWithGet(defenderRef, resolveSnap);
  const sourceDoc = docWithGet(sourceRef, resolveSnap);
  const targetDoc = docWithGet(targetRef, resolveSnap);
  const neighborDocs = new Map<string, ReturnType<typeof docWithGet>>();
  for (const [nid, nref] of neighborRefs) {
    neighborDocs.set(nid, docWithGet(nref, resolveSnap));
  }

  const tx = {
    get: jest.fn((ref: DocRef) => Promise.resolve(resolveSnap(ref))),
    update: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  };

  const tilesCollection = {
    doc: jest.fn((id: string) => {
      if (id === sourceTileId) return sourceDoc;
      if (id === targetTileId) return targetDoc;
      return neighborDocs.get(id) ?? docWithGet({ __kind: "neighbor", id }, resolveSnap);
    }),
    where: jest.fn((field: string, _op: string, value: unknown) => {
      if (field === "ownerId" && value === attackerId) {
        return {
          where: jest.fn((f2: string, op2?: string) => {
            if (f2 === "type" && (op2 === "in" || op2 === "==")) {
              return { get: jest.fn().mockResolvedValue({ docs: ownedDocs }) };
            }
            return { get: jest.fn().mockResolvedValue(EMPTY_QUERY) };
          }),
          get: jest.fn().mockResolvedValue({ docs: ownedDocs }),
        };
      }
      return {
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(EMPTY_QUERY),
        }),
        get: jest.fn().mockResolvedValue(EMPTY_QUERY),
      };
    }),
  };

  const playersCollection = {
    doc: jest.fn((id: string) => {
      if (id === attackerId) return attackerDoc;
      if (id === defenderId) return defenderDoc;
      return docWithGet({ __kind: "player", id }, () => missingSnap);
    }),
  };

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_tiles") return tilesCollection;
      if (name === "game_players") return playersCollection;
      if (name === "game_attacks") return { doc: jest.fn(() => ({})) };
      if (name === "game_pacts") return pactsCollection();
      if (name === "game_artifacts") return { doc: jest.fn(() => ({})) };
      return { doc: jest.fn(), where: jest.fn() };
    }),
    runTransaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  return { db, tx, attackerRef, defenderRef, sourceRef, targetRef };
}

/** Adjacent source/target pair at axial (0,0) → (1,0). */
export function makeAdjacentCombatTiles(overrides?: {
  sourceUnits?: { ground: number; air: number; siege: number };
  targetUnits?: { ground: number; air: number; siege: number };
  targetOwnerId?: string;
}) {
  const targetTileId = "1_0";
  const sourceTileId = "0_0";
  return {
    sourceTileId,
    targetTileId,
    source: {
      ...BASE_TILE,
      tileId: sourceTileId,
      ownerId: "u1",
      q: 0,
      r: 0,
      neighborTileIds: [targetTileId],
      units: overrides?.sourceUnits ?? { ground: 50, air: 0, siege: 0 },
    },
    target: {
      ...BASE_TILE,
      tileId: targetTileId,
      ownerId: overrides?.targetOwnerId ?? "u2",
      q: 1,
      r: 0,
      units: overrides?.targetUnits ?? { ground: 1, air: 0, siege: 0 },
    },
  };
}

export const BASE_ATTACKER = {
  ...BASE_PLAYER,
  userId: "u1",
  displayName: "Attacker",
  caste: "red" as const,
  turnsRemaining: 20,
  stats: {
    unitsAlive: 100,
    tilesHeld: 1000,
    attacksWon: 0,
    attacksLost: 0,
  },
};

export const BASE_DEFENDER = {
  ...BASE_PLAYER,
  userId: "u2",
  displayName: "Defender",
  caste: "blue" as const,
  turnsRemaining: 20,
  stats: {
    unitsAlive: 5,
    tilesHeld: 10,
    attacksWon: 0,
    attacksLost: 0,
  },
};

type TileRef = { __kind: "bulkTile"; id: string };

/**
 * Firestore stub for bulkBuildUnitsServer: pre-read getOwnedTileSummary + tx.getAll.
 */
export function buildBulkMutationDb(opts: {
  player: Record<string, unknown>;
  tiles: Array<{ id: string; data: Record<string, unknown> }>;
  ownedTileDocs?: Array<{ id: string; data: Record<string, unknown> }>;
}) {
  const playerRef = { __kind: "player" as const, id: "u1" };
  const playerSnap = {
    exists: true as const,
    data: () => opts.player,
    id: "u1",
  };

  const tileRefs: TileRef[] = opts.tiles.map((t) => ({
    __kind: "bulkTile",
    id: t.id,
  }));
  const tileSnaps = new Map(
    opts.tiles.map((t) => [
      t.id,
      { exists: true as const, data: () => t.data, id: t.id },
    ]),
  );

  const ownedDocs = (opts.ownedTileDocs ?? opts.tiles).map((d) => ({
    id: d.id,
    data: () => d.data,
    exists: true,
  }));

  const tx = {
    get: jest.fn((ref: { __kind?: string; id?: string }) => {
      if (ref.__kind === "player") return Promise.resolve(playerSnap);
      if (ref.__kind === "bulkTile" && ref.id) {
        return Promise.resolve(tileSnaps.get(ref.id) ?? { exists: false, data: () => undefined });
      }
      return Promise.resolve({ exists: false, data: () => undefined });
    }),
    getAll: jest.fn(async (...refs: Array<{ __kind?: string; id?: string }>) => {
      return refs.map((ref) => {
        if (ref.__kind === "player") return playerSnap;
        if (ref.__kind === "bulkTile" && ref.id) {
          return tileSnaps.get(ref.id) ?? { exists: false, data: () => undefined };
        }
        return { exists: false, data: () => undefined };
      });
    }),
    update: jest.fn(),
    set: jest.fn(),
  };

  const tilesCollection = {
    doc: jest.fn((id: string) => ({ __kind: "bulkTile" as const, id })),
    where: jest.fn((field: string, _op: string, value: unknown) => {
      if (field === "ownerId" && value === "u1") {
        return {
          where: jest.fn((f2: string, op2?: string) => {
            if (f2 === "type" && (op2 === "in" || op2 === "==")) {
              return { get: jest.fn().mockResolvedValue({ docs: ownedDocs }) };
            }
            return { get: jest.fn().mockResolvedValue({ docs: [] }) };
          }),
          get: jest.fn().mockResolvedValue({ docs: ownedDocs }),
        };
      }
      return { get: jest.fn().mockResolvedValue({ docs: [] }) };
    }),
  };

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_tiles") return tilesCollection;
      if (name === "game_players") return { doc: jest.fn(() => playerRef) };
      if (name === "game_artifacts") return { doc: jest.fn(() => ({})) };
      return { doc: jest.fn(), where: jest.fn() };
    }),
    runTransaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  return { db, tx, playerRef, tileRefs };
}

/**
 * Three-tile redistribute stub (player + source + dest) with optional pre-read .get().
 */
export function buildRedistributeMutationDb(opts: {
  player: Record<string, unknown>;
  source: Record<string, unknown>;
  dest: Record<string, unknown>;
  sourceId?: string;
  destId?: string;
}) {
  const sourceId = opts.sourceId ?? "s";
  const destId = opts.destId ?? "d";
  const sourceRef = { __kind: "source" as const, id: sourceId };
  const destRef = { __kind: "dest" as const, id: destId };
  const playerRef = { __kind: "player" as const, id: "u1" };

  const resolve = (ref: { __kind?: string }) => {
    if (ref.__kind === "player") {
      return { exists: true, data: () => opts.player };
    }
    if (ref.__kind === "source") {
      return { exists: true, data: () => opts.source };
    }
    if (ref.__kind === "dest") {
      return { exists: true, data: () => opts.dest };
    }
    return { exists: false, data: () => undefined };
  };

  const docWithGet = (ref: typeof sourceRef | typeof destRef | typeof playerRef) => ({
    ...ref,
    get: jest.fn(() => Promise.resolve(resolve(ref))),
  });

  const tx = {
    get: jest.fn((ref: { __kind?: string }) => Promise.resolve(resolve(ref))),
    update: jest.fn(),
  };

  const db = {
    collection: jest.fn((name: string) => {
      if (name === "game_players") {
        return { doc: jest.fn(() => docWithGet(playerRef)) };
      }
      if (name === "game_tiles") {
        return {
          doc: jest.fn((id: string) => {
            if (id === sourceId) return docWithGet(sourceRef);
            if (id === destId) return docWithGet(destRef);
            return docWithGet({ __kind: "dest", id });
          }),
        };
      }
      return { doc: jest.fn() };
    }),
    runTransaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  return { db, tx, sourceRef, destRef, playerRef };
}
