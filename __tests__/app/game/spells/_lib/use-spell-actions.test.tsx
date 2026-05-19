/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import type { GamePlayer, MapTile } from "@/lib/game/types";

jest.mock("@/lib/game/local-map-cache", () => ({
  mergeTiles: jest.fn(),
}));

import { mergeTiles } from "@/lib/game/local-map-cache";
import { useSpellActions } from "@/app/game/spells/_lib/use-spell-actions";

const mockMergeTiles = mergeTiles as jest.Mock;

function makeUser() {
  return {
    uid: "spell-user",
    getIdToken: jest.fn().mockResolvedValue("spell-token"),
  } as unknown as User;
}

const baseTile: MapTile = {
  tileId: "2_1",
  q: 2,
  r: 1,
  type: "military",
  ownerId: "spell-user",
  units: { ground: 1, siege: 0, air: 0 },
  armedDefenseSpellId: null,
};

const basePlayer = {
  userId: "spell-user",
  displayName: "Caster",
  caste: "red" as const,
  turnsRemaining: 3,
  turnsSpentTotal: 0,
  phase: "play" as const,
  tilesExplored: 1,
  shieldUntil: new Date(),
  shieldDropAtTurn: 0,
  productionSpellsActive: [],
  stats: {
    attacksWon: 0,
    attacksLost: 0,
    tilesHeld: 1,
    unitsAlive: 1,
  },
} satisfies Partial<GamePlayer> as GamePlayer;

describe("useSpellActions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  function mountHook() {
    const setError = jest.fn();
    const setPlayer = jest.fn();
    const setTiles = jest.fn(
      (update: MapTile[] | ((prev: MapTile[]) => MapTile[])) => {
        const prev = [baseTile];
        const next = typeof update === "function" ? update(prev) : update;
        return next;
      },
    );
    const hook = renderHook(() =>
      useSpellActions({
        user: makeUser(),
        setError,
        setPlayer,
        setTiles,
      }),
    );
    return { ...hook, setError, setPlayer, setTiles };
  }

  it("returns null from callApi when user is missing", async () => {
    const setError = jest.fn();
    const { result } = renderHook(() =>
      useSpellActions({
        user: null,
        setError,
        setPlayer: jest.fn(),
        setTiles: jest.fn(),
      }),
    );

    await act(async () => {
      await result.current.castProduction("fireball");
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("casts production spell and merges player state", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        success: true,
        player: { ...basePlayer, turnsRemaining: 2 },
        report: { id: "r1", summary: "Produced" },
      }),
    });

    const { result, setPlayer } = mountHook();

    await act(async () => {
      await result.current.castProduction("ember-bolt");
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/game/spell/produce",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ spellId: "ember-bolt" }),
        }),
      );
    });
    expect(setPlayer).toHaveBeenCalledWith(
      expect.objectContaining({ turnsRemaining: 2 }),
    );
    expect(result.current.recentReports).toHaveLength(1);
    expect(result.current.busyId).toBeNull();
  });

  it("sets error when API returns success: false", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        success: false,
        error: { message: "Not enough mana" },
      }),
    });

    const { result, setError } = mountHook();

    await act(async () => {
      await result.current.castProduction("ember-bolt");
    });

    expect(setError).toHaveBeenCalledWith("Not enough mana");
  });

  it("arms defense on a single tile and updates cache", async () => {
    const updatedTile = { ...baseTile, armedDefenseSpellId: "ward" };
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        success: true,
        tile: updatedTile,
      }),
    });

    const { result } = mountHook();

    await act(async () => {
      await result.current.armDefenseSingle("ward", "2_1");
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/game/spell/arm",
      expect.objectContaining({
        body: JSON.stringify({ spellId: "ward", tileId: "2_1" }),
      }),
    );
    expect(mockMergeTiles).toHaveBeenCalledWith("spell-user", [updatedTile]);
  });

  it("surfaces validation error when arming without a tile", async () => {
    const { result, setError } = mountHook();

    await act(async () => {
      await result.current.armDefenseSingle("ward", "");
    });

    expect(setError).toHaveBeenCalledWith(
      "Pick a tile to arm the spell on first.",
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("reports partial bulk arm failures", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        success: true,
        armed: 1,
        failed: [{ tileId: "3_1", reason: "not owned" }],
        tiles: [baseTile],
      }),
    });

    const { result, setError } = mountHook();

    await act(async () => {
      await result.current.armDefenseBulk("ward", ["2_1", "3_1"]);
    });

    expect(setError).toHaveBeenCalledWith(
      expect.stringContaining("Armed 1 of 2"),
    );
  });

  it("skips bulk arm when tile list is empty", async () => {
    const { result } = mountHook();

    let data: unknown;
    await act(async () => {
      data = await result.current.armDefenseBulk("ward", []);
    });

    expect(data).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
