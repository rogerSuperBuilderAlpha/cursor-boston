/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import { useTilesData } from "@/app/game/tiles/_lib/use-tiles-data";
import {
  loadCachedMap,
  saveCachedMap,
} from "@/lib/game/local-map-cache";
import { useWorldSnapshotListener } from "@/app/game/_lib/use-world-snapshot-listener";
import type { MapTile } from "@/lib/game/types";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/game/local-map-cache", () => ({
  loadCachedMap: jest.fn(),
  saveCachedMap: jest.fn(),
}));

jest.mock("@/app/game/_lib/use-world-snapshot-listener", () => ({
  useWorldSnapshotListener: jest.fn(),
}));

import { useAuth } from "@/contexts/AuthContext";

const mockUseAuth = useAuth as jest.Mock;
const mockLoadCachedMap = loadCachedMap as jest.Mock;
const mockUseWorldSnapshotListener = useWorldSnapshotListener as jest.Mock;

const MY_TILE: MapTile = {
  tileId: "0_0",
  q: 0,
  r: 0,
  type: "military",
  ownerId: "u1",
  units: { ground: 1, siege: 0, air: 0 },
  armedDefenseSpellId: null,
};

const ENEMY_TILE: MapTile = {
  tileId: "1_0",
  q: 1,
  r: 0,
  type: "economic",
  ownerId: "enemy",
  units: { ground: 0, siege: 0, air: 0 },
  armedDefenseSpellId: null,
};

function makeUser(uid = "u1") {
  return {
    uid,
    getIdToken: jest.fn().mockResolvedValue(`token-${uid}`),
  } as unknown as User;
}

describe("useTilesData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWorldSnapshotListener.mockReturnValue({
      snapshot: null,
      connected: false,
    });
    mockLoadCachedMap.mockReturnValue(null);
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });
    global.fetch = jest.fn();
  });

  it("stays idle when signed out", () => {
    const { result } = renderHook(() => useTilesData());
    expect(result.current.player).toBeNull();
    expect(result.current.tiles).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("hydrates from cache and fetches player without map refetch", async () => {
    const user = makeUser();
    mockUseAuth.mockReturnValue({ user, loading: false });
    mockLoadCachedMap.mockReturnValue({
      myTiles: [MY_TILE],
      borderTiles: [ENEMY_TILE],
      owners: [
        {
          userId: "enemy",
          displayName: "Rival",
          caste: "red",
          shielded: false,
          isNpc: false,
        },
      ],
      lastFetchedAt: Date.now(),
    });

    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url.includes("/api/game/player")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: { id: user.uid, displayName: "Me", turnsRemaining: 1 },
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    const { result } = renderHook(() => useTilesData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.tiles).toHaveLength(2);
    expect(result.current.ownersById.get("enemy")?.displayName).toBe("Rival");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/game/player",
      expect.objectContaining({
        headers: { Authorization: "Bearer token-u1" },
      })
    );
    expect(global.fetch).not.toHaveBeenCalledWith(
      "/api/game/map/me",
      expect.anything()
    );
  });

  it("fetches personal map when cache is empty", async () => {
    const user = makeUser();
    mockUseAuth.mockReturnValue({ user, loading: false });

    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url.includes("/api/game/player")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: { id: user.uid, displayName: "Me", turnsRemaining: 1 },
          }),
        };
      }
      if (url.includes("/api/game/map/me")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            myTiles: [MY_TILE],
            borderTiles: [],
            owners: [],
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    const { result } = renderHook(() => useTilesData());

    await waitFor(() => {
      expect(result.current.tiles).toHaveLength(1);
    });
    expect(saveCachedMap).toHaveBeenCalled();
  });

  it("derives personal tiles from live snapshot listener", async () => {
    const user = makeUser();
    mockUseAuth.mockReturnValue({ user, loading: false });

    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (url.includes("/api/game/player")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: { id: user.uid, displayName: "Me", turnsRemaining: 1 },
          }),
        };
      }
      if (url.includes("/api/game/map/me")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            myTiles: [MY_TILE],
            borderTiles: [],
            owners: [],
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    mockUseWorldSnapshotListener.mockReturnValue({
      snapshot: {
        tiles: [MY_TILE, ENEMY_TILE],
        owners: [
          {
            userId: "enemy",
            displayName: "Rival",
            caste: "red",
            shielded: false,
            isNpc: false,
          },
        ],
      },
      connected: true,
    });

    const { result } = renderHook(() => useTilesData());

    await waitFor(() => {
      expect(result.current.tiles.length).toBeGreaterThan(0);
    });
    expect(saveCachedMap).toHaveBeenCalledWith(
      user.uid,
      expect.objectContaining({
        myTiles: expect.arrayContaining([
          expect.objectContaining({ tileId: "0_0" }),
        ]),
      })
    );
    expect(result.current.liveConnected).toBe(true);
  });

  it("fetchWorldOnce surfaces HTTP errors in world mode", async () => {
    const user = makeUser();
    mockUseAuth.mockReturnValue({ user, loading: false });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ success: false }),
    });

    const { result } = renderHook(() => useTilesData());

    await act(async () => {
      await result.current.fetchWorldOnce();
    });

    expect(result.current.worldError).toMatch(/503/);
  });
});
