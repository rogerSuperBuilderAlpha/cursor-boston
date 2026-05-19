/**
 * @jest-environment node
 *
 * Exercises Zod parsers wired into gameContract — valid payloads pass,
 * malformed bodies / query / path params fail safeParse.
 */
import { gameContract } from "@/lib/api-schemas/game";
import type { z } from "zod";

type ZodSchema = z.ZodTypeAny;

function schemaOf(route: { body?: ZodSchema; query?: ZodSchema; pathParams?: ZodSchema }) {
  return {
    body: route.body,
    query: route.query,
    pathParams: route.pathParams,
  };
}

describe("lib/api-schemas/game — body validation", () => {
  const attack = schemaOf(gameContract.attack);
  const build = schemaOf(gameContract.build);
  const setupCaste = schemaOf(gameContract.setupCaste);
  const spellArm = schemaOf(gameContract.spellArm);
  const exploreBulk = schemaOf(gameContract.exploreBulk);
  const playerCreate = schemaOf(gameContract.createPlayer);
  const flyover = schemaOf(gameContract.flyover);
  const distributeBulk = schemaOf(gameContract.distributeBulk);
  const communityChat = schemaOf(gameContract.postCommunityChat);

  it("AttackBody accepts a minimal valid attack", () => {
    const r = attack.body!.safeParse({
      sourceTileId: "tile-a",
      targetTileId: "tile-b",
      units: { ground: 10, siege: 0, air: 0 },
    });
    expect(r.success).toBe(true);
  });

  it("AttackBody rejects missing tile ids and negative unit counts", () => {
    expect(
      attack.body!.safeParse({
        sourceTileId: "",
        targetTileId: "tile-b",
        units: { ground: 10, siege: 0, air: 0 },
      }).success
    ).toBe(false);
    expect(
      attack.body!.safeParse({
        sourceTileId: "tile-a",
        targetTileId: "tile-b",
        units: { ground: -1, siege: 0, air: 0 },
      }).success
    ).toBe(false);
  });

  it("AttackBody rejects dispatch longer than 280 chars", () => {
    const r = attack.body!.safeParse({
      sourceTileId: "tile-a",
      targetTileId: "tile-b",
      units: { ground: 1, siege: 0, air: 0 },
      dispatch: "x".repeat(281),
    });
    expect(r.success).toBe(false);
  });

  it("BuildBody accepts ground builds and rejects unknown unit types", () => {
    expect(
      build.body!.safeParse({
        tileId: "tile-1",
        unitType: "ground",
        count: 5,
      }).success
    ).toBe(true);
    expect(
      build.body!.safeParse({
        tileId: "tile-1",
        unitType: "navy",
        count: 5,
      }).success
    ).toBe(false);
  });

  it("SetupCasteBody accepts setup castes and rejects gameplay castes", () => {
    expect(setupCaste.body!.safeParse({ caste: "black" }).success).toBe(true);
    expect(setupCaste.body!.safeParse({ caste: "military" }).success).toBe(false);
  });

  it("SpellArmBody requires tileId or a non-empty tileIds array", () => {
    expect(
      spellArm.body!.safeParse({ spellId: "shield-1", tileId: "t1" }).success
    ).toBe(true);
    expect(
      spellArm.body!.safeParse({
        spellId: "shield-1",
        tileIds: ["t1", "t2"],
      }).success
    ).toBe(true);
    expect(spellArm.body!.safeParse({ spellId: "shield-1" }).success).toBe(false);
    expect(
      spellArm.body!.safeParse({ spellId: "shield-1", tileIds: [] }).success
    ).toBe(false);
  });

  it("ExploreBulkBody requires a positive integer count", () => {
    expect(exploreBulk.body!.safeParse({ count: 3 }).success).toBe(true);
    expect(exploreBulk.body!.safeParse({}).success).toBe(false);
    expect(exploreBulk.body!.safeParse({ count: 0 }).success).toBe(false);
  });

  it("PlayerCreateBody requires a non-empty displayName", () => {
    expect(playerCreate.body!.safeParse({ displayName: "Sun Tzu" }).success).toBe(
      true
    );
    expect(playerCreate.body!.safeParse({ displayName: "" }).success).toBe(false);
  });

  it("FlyoverBody accepts air-only stacks with valid tile ids", () => {
    const r = flyover.body!.safeParse({
      sourceTileId: "s",
      targetTileId: "t",
      units: { ground: 0, siege: 0, air: 5 },
    });
    expect(r.success).toBe(true);
  });

  it("DistributeBulkBody requires at least one tile id and a land type", () => {
    expect(
      distributeBulk.body!.safeParse({
        tileIds: ["t1"],
        type: "food",
      }).success
    ).toBe(true);
    expect(
      distributeBulk.body!.safeParse({ tileIds: [], type: "food" }).success
    ).toBe(false);
    expect(
      distributeBulk.body!.safeParse({ tileIds: ["t1"], type: "ocean" }).success
    ).toBe(false);
  });

  it("Community chat body enforces 1..500 char messages", () => {
    expect(
      communityChat.body!.safeParse({ body: "hello" }).success
    ).toBe(true);
    expect(communityChat.body!.safeParse({ body: "" }).success).toBe(false);
    expect(
      communityChat.body!.safeParse({ body: "x".repeat(501) }).success
    ).toBe(false);
  });
});

describe("lib/api-schemas/game — query + path validation", () => {
  const world = schemaOf(gameContract.getWorld);
  const tile = schemaOf(gameContract.getTile);
  const leaderboard = schemaOf(gameContract.getLeaderboard);
  const heroes = schemaOf(gameContract.getHeroesList);

  it("WorldQuery accepts optional integer bbox strings", () => {
    expect(
      world.query!.safeParse({ qMin: "-5", qMax: "5", rMin: "0", rMax: "10" })
        .success
    ).toBe(true);
    expect(world.query!.safeParse({}).success).toBe(true);
  });

  it("WorldQuery rejects non-integer bbox tokens", () => {
    expect(world.query!.safeParse({ qMin: "1.5" }).success).toBe(false);
    expect(world.query!.safeParse({ qMin: "abc" }).success).toBe(false);
  });

  it("TileParam requires a non-empty tileId path segment", () => {
    expect(tile.pathParams!.safeParse({ tileId: "hex-1" }).success).toBe(true);
    expect(tile.pathParams!.safeParse({ tileId: "" }).success).toBe(false);
  });

  it("Leaderboard query accepts audience filter + pagination", () => {
    const r = leaderboard.query!.safeParse({ audience: "npc", limit: "50" });
    expect(r.success).toBe(true);
  });

  it("Leaderboard query rejects unknown audience values", () => {
    expect(
      leaderboard.query!.safeParse({ audience: "bots" }).success
    ).toBe(false);
  });

  it("Heroes list query accepts scope and rejects unknown scope", () => {
    expect(heroes.query!.safeParse({ scope: "fallen" }).success).toBe(true);
    expect(heroes.query!.safeParse({ scope: "retired" }).success).toBe(false);
  });
});
