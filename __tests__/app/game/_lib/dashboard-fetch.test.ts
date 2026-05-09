/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { fetchInitialData } from "@/app/game/_lib/dashboard-fetch";

// Mock the cache so we can control whether the cached-path or refetch-path
// is exercised by each test.
jest.mock("@/lib/game/local-map-cache", () => ({
  loadCachedMap: jest.fn(),
  saveCachedMap: jest.fn(),
}));
import {
  loadCachedMap,
  saveCachedMap,
} from "@/lib/game/local-map-cache";

const FAKE_PLAYER = { id: "me", turnsRemaining: 100 };
const FAKE_TILE = {
  tileId: "0_0",
  q: 0,
  r: 0,
  type: "military",
  ownerId: "me",
  units: { ground: 0, siege: 0, air: 0 },
  armedDefenseSpellId: null,
};

function makeUser(uid = "me") {
  return {
    uid,
    getIdToken: jest.fn().mockResolvedValue(`token-${uid}`),
  } as unknown as Parameters<typeof fetchInitialData>[0];
}

function makeSetters() {
  return {
    setPlayer: jest.fn(),
    setTiles: jest.fn(),
    setServerIsAdmin: jest.fn(),
    setEligibility: jest.fn(),
    setWorldTiles: jest.fn(),
    setWorldOwners: jest.fn(),
    setArtifacts: jest.fn(),
    setError: jest.fn(),
    setLoading: jest.fn(),
  };
}

/** Mock fetch with one queued response per request, in order. */
function mockFetchSequence(...responses: unknown[]) {
  let i = 0;
  const fetchMock = jest.fn().mockImplementation(() => {
    const next = responses[i++];
    return Promise.resolve({ json: () => Promise.resolve(next) });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe("fetchInitialData", () => {
  it("populates player, eligibility, and artifacts in parallel", async () => {
    (loadCachedMap as jest.Mock).mockReturnValue({
      myTiles: [],
      borderTiles: [FAKE_TILE],
      owners: [
        {
          userId: "foe",
          displayName: "Foe",
          caste: null,
          shielded: false,
        },
      ],
      lastFetchedAt: Date.now(),
    });
    mockFetchSequence(
      // /api/game/player
      { success: true, player: FAKE_PLAYER, tiles: [FAKE_TILE], isAdmin: true },
      // /api/game/eligibility
      {
        success: true,
        githubLogin: "octocat",
        mergedPrCountThisWeek: 3,
        nextRolloverIso: "2026-05-15T00:00:00Z",
        windowStartIso: "2026-05-08T00:00:00Z",
      },
      // /api/game/artifacts
      {
        success: true,
        artifacts: [
          { id: "a", used: false },
          { id: "b", used: true },
        ],
      }
    );
    const setters = makeSetters();
    await fetchInitialData(makeUser(), setters);

    expect(setters.setPlayer).toHaveBeenCalledWith(FAKE_PLAYER);
    expect(setters.setTiles).toHaveBeenCalledWith([FAKE_TILE]);
    expect(setters.setServerIsAdmin).toHaveBeenCalledWith(true);
    expect(setters.setEligibility).toHaveBeenCalledWith(
      expect.objectContaining({
        githubLogin: "octocat",
        mergedPrCountThisWeek: 3,
      })
    );
    // Used artifacts must be filtered out.
    expect(setters.setArtifacts).toHaveBeenCalledWith([{ id: "a", used: false }]);
    expect(setters.setWorldTiles).toHaveBeenCalledWith([FAKE_TILE]);
    expect(setters.setLoading).toHaveBeenCalledWith(false);
  });

  it("falls back to /map/me + saveCachedMap when no cache exists", async () => {
    (loadCachedMap as jest.Mock).mockReturnValue(null);
    mockFetchSequence(
      { success: true, player: FAKE_PLAYER, tiles: [], isAdmin: false },
      {
        success: true,
        githubLogin: null,
        mergedPrCountThisWeek: 0,
        nextRolloverIso: "2026-05-15T00:00:00Z",
        windowStartIso: "2026-05-08T00:00:00Z",
      },
      { success: true, artifacts: [] },
      // /api/game/map/me
      {
        success: true,
        myTiles: [],
        borderTiles: [FAKE_TILE],
        owners: [],
      }
    );
    const setters = makeSetters();
    await fetchInitialData(makeUser(), setters);
    expect(saveCachedMap).toHaveBeenCalled();
    expect(setters.setWorldTiles).toHaveBeenCalledWith([FAKE_TILE]);
  });

  it("surfaces an error when the player fetch fails", async () => {
    (loadCachedMap as jest.Mock).mockReturnValue(null);
    mockFetchSequence(
      { success: false, error: "auth failed" },
      { success: true, githubLogin: null, mergedPrCountThisWeek: 0, nextRolloverIso: "x", windowStartIso: "y" },
      { success: true, artifacts: [] }
    );
    const setters = makeSetters();
    await fetchInitialData(makeUser(), setters);
    expect(setters.setError).toHaveBeenCalledWith("auth failed");
    expect(setters.setLoading).toHaveBeenLastCalledWith(false);
  });

  it("ignores artifact response when success=false", async () => {
    (loadCachedMap as jest.Mock).mockReturnValue({
      myTiles: [],
      borderTiles: [],
      owners: [],
      lastFetchedAt: 0,
    });
    mockFetchSequence(
      { success: true, player: FAKE_PLAYER, tiles: [], isAdmin: false },
      { success: true, githubLogin: null, mergedPrCountThisWeek: 0, nextRolloverIso: "x", windowStartIso: "y" },
      { success: false }
    );
    const setters = makeSetters();
    await fetchInitialData(makeUser(), setters);
    expect(setters.setArtifacts).not.toHaveBeenCalled();
  });
});
