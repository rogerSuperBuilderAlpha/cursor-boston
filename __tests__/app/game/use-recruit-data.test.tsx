/**
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage push #86 — useRecruitData hook.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import { useRecruitData } from "@/app/game/recruit/_lib/use-recruit-data";
import {
  loadCachedMap,
  saveCachedMap,
} from "@/lib/game/local-map-cache";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/game/local-map-cache", () => ({
  loadCachedMap: jest.fn(),
  saveCachedMap: jest.fn(),
}));

import { useAuth } from "@/contexts/AuthContext";

const mockUseAuth = useAuth as jest.Mock;
const mockLoadCachedMap = loadCachedMap as jest.Mock;
const mockSaveCachedMap = saveCachedMap as jest.Mock;

function makeUser(uid = "u1") {
  return {
    uid,
    getIdToken: jest.fn().mockResolvedValue(`token-${uid}`),
  } as unknown as User;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadCachedMap.mockReturnValue(null);
  mockUseAuth.mockReturnValue({ user: null, loading: false });
  global.fetch = jest.fn();
});

describe("useRecruitData", () => {
  it("stays idle while auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    const { result } = renderHook(() => useRecruitData());
    expect(result.current.loading).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns empty state when signed out", () => {
    const { result } = renderHook(() => useRecruitData());
    expect(result.current.player).toBeNull();
    expect(result.current.tiles).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("hydrates from local map cache when available, then loads player", async () => {
    mockUseAuth.mockReturnValue({ user: makeUser("u1"), loading: false });
    mockLoadCachedMap.mockReturnValue({
      myTiles: [],
      borderTiles: [
        {
          tileId: "1_0",
          q: 1,
          r: 0,
          type: "economic",
          ownerId: "enemy",
          units: { ground: 1, siege: 0, air: 0 },
          armedDefenseSpellId: null,
        },
      ],
      owners: [{ userId: "enemy", displayName: "Enemy" }],
      lastFetchedAt: Date.now(),
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        success: true,
        player: { userId: "u1", caste: "white" },
        tiles: [],
      }),
    });
    const { result } = renderHook(() => useRecruitData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.borderTiles).toHaveLength(1);
    expect(result.current.owners.size).toBe(1);
    expect(result.current.player).toMatchObject({ userId: "u1", caste: "white" });
  });

  it("fetches map/me when cache is empty, persists it, and loads player", async () => {
    mockUseAuth.mockReturnValue({ user: makeUser("u2"), loading: false });
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/api/game/map/me")) {
        return Promise.resolve({
          json: async () => ({
            success: true,
            myTiles: [],
            borderTiles: [
              {
                tileId: "2_0",
                q: 2,
                r: 0,
                type: "economic",
                ownerId: "enemy2",
                units: { ground: 0, siege: 0, air: 0 },
                armedDefenseSpellId: null,
              },
            ],
            owners: [{ userId: "enemy2", displayName: "Enemy Two" }],
          }),
        });
      }
      return Promise.resolve({
        json: async () => ({
          success: true,
          player: { userId: "u2", caste: "blue" },
          tiles: [],
        }),
      });
    });
    const { result } = renderHook(() => useRecruitData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockSaveCachedMap).toHaveBeenCalled();
    expect(result.current.borderTiles).toHaveLength(1);
    expect(result.current.owners.size).toBe(1);
  });

  it("swallows map/me fetch errors silently (player still loads)", async () => {
    mockUseAuth.mockReturnValue({ user: makeUser("u3"), loading: false });
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/api/game/map/me")) {
        return Promise.reject(new Error("network"));
      }
      return Promise.resolve({
        json: async () => ({
          success: true,
          player: { userId: "u3", caste: "red" },
          tiles: [],
        }),
      });
    });
    const { result } = renderHook(() => useRecruitData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.player).toMatchObject({ userId: "u3" });
    expect(result.current.error).toBeNull();
  });

  it("surfaces error message when player fetch returns success=false (string error)", async () => {
    mockUseAuth.mockReturnValue({ user: makeUser("u4"), loading: false });
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        success: false,
        error: "Player not found",
      }),
    });
    const { result } = renderHook(() => useRecruitData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Player not found");
  });

  it("surfaces error.message when player fetch returns object error", async () => {
    mockUseAuth.mockReturnValue({ user: makeUser("u5"), loading: false });
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        success: false,
        error: { message: "Custom failure message" },
      }),
    });
    const { result } = renderHook(() => useRecruitData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Custom failure message");
  });

  it("falls back to 'Failed to load' when error is missing entirely", async () => {
    mockUseAuth.mockReturnValue({ user: makeUser("u6"), loading: false });
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ success: false }),
    });
    const { result } = renderHook(() => useRecruitData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Failed to load");
  });

  it("sets error when fetch itself throws", async () => {
    mockUseAuth.mockReturnValue({ user: makeUser("u7"), loading: false });
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/api/game/player")) {
        return Promise.reject(new Error("network down"));
      }
      // map/me: cache is empty so we hit fetch first; mock returns failure
      return Promise.resolve({ json: async () => ({ success: false }) });
    });
    const { result } = renderHook(() => useRecruitData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("network down");
  });

  it("exposes setPlayer / setTiles / setError setters for caller mutation", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    const { result } = renderHook(() => useRecruitData());
    act(() => {
      result.current.setError("manual error");
    });
    expect(result.current.error).toBe("manual error");
  });
});
