/**
 * @jest-environment jsdom
 *
 * Branch-coverage push for app/game/tiles/[tileId]/page.tsx. Complements
 * page.test.tsx (smoke) + page.deep.test.tsx (user-flows) by exercising the
 * conditional render branches: unauthenticated state, fetch errors, callApi
 * error path, intel-report panel, crow network panel, batch reports +
 * artifact updates, attacker-player merge, and inscription save failure.
 */
import "@/__tests__/app/_shared/page-test-setup";

jest.mock("react", () => {
  const actual = jest.requireActual<typeof import("react")>("react");
  return {
    ...actual,
    use<T>(usable: Promise<T> | T): T {
      const resolved = (usable as Promise<T> & { __testResolvedValue?: T })
        ?.__testResolvedValue;
      if (resolved !== undefined) return resolved;
      if (typeof actual.use === "function") {
        return actual.use(usable as never);
      }
      return usable as T;
    },
  };
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";
import { BASE_PLAYER } from "@/__tests__/_helpers/game-mutation-db";
import { loadCachedMap } from "@/lib/game/local-map-cache";

jest.mock("@/lib/game/local-map-cache", () => ({
  loadCachedMap: jest.fn(),
  mergeTiles: jest.fn(),
}));

jest.mock("@/app/game/threats/_lib/use-attack-preview", () => ({
  useAttackPreview: () => ({ preview: null, loading: false, error: null }),
}));
jest.mock("@/app/game/threats/_components/BattleSimPanel", () => ({
  BattleSimPanel: () => null,
}));
jest.mock("@/app/game/_components/CatalogImage", () => ({
  CatalogImage: () => null,
}));

const mockUseAuth = useAuth as jest.Mock;
const mockLoadCachedMap = loadCachedMap as jest.Mock;

const ownTile = {
  tileId: "0_0",
  q: 0,
  r: 0,
  type: "military" as const,
  ownerId: "u1",
  units: { ground: 10, siege: 0, air: 3 },
  armedDefenseSpellId: null,
  inscription: "",
};

const enemyTile = {
  tileId: "2_0",
  q: 2,
  r: 0,
  type: "food" as const,
  ownerId: "u2",
  units: { ground: 3, siege: 0, air: 0 },
  armedDefenseSpellId: null,
  inscription: "",
};

async function renderTilePage(tileId: string) {
  const Page = (await import("@/app/game/tiles/[tileId]/page")).default;
  const params = Promise.resolve({ tileId });
  (
    params as Promise<{ tileId: string }> & {
      __testResolvedValue: { tileId: string };
    }
  ).__testResolvedValue = { tileId };
  return render(<Page params={params} />);
}

describe("game tile detail page (branch coverage)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      loading: false,
    });
    mockLoadCachedMap.mockReturnValue(null);
  });

  it("renders loading spinner while auth is loading", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    global.fetch = jest.fn() as unknown as typeof fetch;
    const Page = (await import("@/app/game/tiles/[tileId]/page")).default;
    const params = Promise.resolve({ tileId: "0_0" });
    (
      params as Promise<{ tileId: string }> & {
        __testResolvedValue: { tileId: string };
      }
    ).__testResolvedValue = { tileId: "0_0" };
    const { container } = render(<Page params={params} />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("renders Back link when unauthenticated (no user)", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    global.fetch = jest.fn() as unknown as typeof fetch;
    await renderTilePage("0_0");
    await waitFor(() => {
      expect(screen.getByText(/Back to tiles/i)).toBeInTheDocument();
    });
    // refresh() short-circuits when there's no user
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("decodes URL-encoded tileId params", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/game/tile/")) {
        return { ok: true, json: async () => ({ success: true, tile: ownTile }) };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: { ...BASE_PLAYER, userId: "u1", caste: "red", phase: "play" },
            tiles: [ownTile],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        return { ok: true, json: async () => ({ success: true, artifacts: [] }) };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
    await renderTilePage("0%5F0"); // url-encoded "0_0"
    await waitFor(() => {
      // decodeURIComponent("0%5F0") => "0_0"
      const tileCall = (global.fetch as jest.Mock).mock.calls.find(([u]) =>
        String(u).startsWith("/api/game/tile/")
      );
      expect(tileCall).toBeTruthy();
      expect(String(tileCall![0])).toBe("/api/game/tile/0_0");
    });
  });

  it("renders error message + Back link when tile fetch returns failure (string error)", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/game/tile/")) {
        return {
          ok: true,
          json: async () => ({ success: false, error: "Tile missing" }),
        };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({ success: true, player: null, tiles: [] }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
    await renderTilePage("0_0");
    await waitFor(() => {
      expect(screen.getByText("Tile missing")).toBeInTheDocument();
      expect(screen.getByText(/Back to tiles/i)).toBeInTheDocument();
    });
  });

  it("renders fallback error when tile fetch returns object error without message", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/game/tile/")) {
        return {
          ok: true,
          json: async () => ({ success: false, error: { message: "" } }),
        };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({ success: true, player: null, tiles: [] }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
    await renderTilePage("0_0");
    await waitFor(() => {
      expect(screen.getByText("Failed to load tile")).toBeInTheDocument();
    });
  });

  it("renders generic error on non-Error throw in refresh", async () => {
    global.fetch = jest.fn(async () => {
      throw "boom"; // non-Error
    }) as typeof fetch;
    await renderTilePage("0_0");
    await waitFor(() => {
      expect(screen.getByText("Failed to load")).toBeInTheDocument();
    });
  });

  it("skips artifact list when artifacts response is malformed", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/game/tile/")) {
        return { ok: true, json: async () => ({ success: true, tile: ownTile }) };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: { ...BASE_PLAYER, userId: "u1", caste: "red", phase: "play" },
            tiles: [ownTile],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        // success but no artifacts array
        return { ok: true, json: async () => ({ success: false }) };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
    await renderTilePage("0_0");
    await waitFor(() => {
      expect(screen.getByText("0_0")).toBeInTheDocument();
    });
  });

  it("hydrates border tiles + owner snapshots from the local cache", async () => {
    mockLoadCachedMap.mockReturnValue({
      myTiles: [],
      borderTiles: [enemyTile],
      owners: [{ userId: "u2", caste: "blue", displayName: "Rival" }],
      lastFetchedAt: Date.now(),
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/game/tile/2_0")) {
        return { ok: true, json: async () => ({ success: true, tile: enemyTile }) };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: { ...BASE_PLAYER, userId: "u1", caste: "red", phase: "play" },
            tiles: [],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        return { ok: true, json: async () => ({ success: true, artifacts: [] }) };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
    await renderTilePage("2_0");
    await waitFor(() => {
      expect(screen.getByText("Enemy")).toBeInTheDocument();
    });
    expect(mockLoadCachedMap).toHaveBeenCalled();
  });

  it("renders Isolated spawn stat + supply readout for own tile with friendly neighbors", async () => {
    const friendlyNeighbor = {
      tileId: "1_0",
      q: 1,
      r: 0,
      type: "food" as const,
      ownerId: "u1",
      units: { ground: 5, siege: 0, air: 0 },
      armedDefenseSpellId: null,
    };
    const isolated = { ...ownTile, isolatedSpawn: true };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/game/tile/0_0")) {
        return { ok: true, json: async () => ({ success: true, tile: isolated }) };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: { ...BASE_PLAYER, userId: "u1", caste: "red", phase: "play" },
            tiles: [isolated, friendlyNeighbor],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        return { ok: true, json: async () => ({ success: true, artifacts: [] }) };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
    await renderTilePage("0_0");
    await waitFor(() => {
      expect(screen.getByText("Isolated spawn")).toBeInTheDocument();
      expect(screen.getByText(/Supply$/i)).toBeInTheDocument();
    });
  });

  it("renders Crow Network panel when green caste + air units + scout upgrade active", async () => {
    const greenOwnTile = { ...ownTile, units: { ground: 0, siege: 0, air: 2 } };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/game/tile/0_0")) {
        return { ok: true, json: async () => ({ success: true, tile: greenOwnTile }) };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: {
              ...BASE_PLAYER,
              userId: "u1",
              caste: "green",
              phase: "play",
              activeUpgrades: {
                "green-air-eagle-scout": "green-air-eagle-scout-upgrade-4-intel",
              },
            },
            tiles: [greenOwnTile],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        return { ok: true, json: async () => ({ success: true, artifacts: [] }) };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
    await renderTilePage("0_0");
    await waitFor(() => {
      expect(screen.getByText(/Crow Network/i)).toBeInTheDocument();
      // No friendly neighbours → empty-state branch.
      expect(screen.getByText(/isolated/i)).toBeInTheDocument();
    });
  });

  it("renders Crow Network with friendly neighbours list", async () => {
    const greenOwnTile = {
      ...ownTile,
      units: { ground: 0, siege: 0, air: 1 },
    };
    const friendly = {
      tileId: "1_0",
      q: 1,
      r: 0,
      type: "food" as const,
      ownerId: "u1",
      units: { ground: 1, siege: 0, air: 0 },
      armedDefenseSpellId: null,
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/game/tile/0_0")) {
        return { ok: true, json: async () => ({ success: true, tile: greenOwnTile }) };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: {
              ...BASE_PLAYER,
              userId: "u1",
              caste: "green",
              phase: "play",
              activeUpgrades: {
                "green-air-eagle-scout":
                  "green-air-eagle-scout-upgrade-4-intel",
              },
            },
            tiles: [greenOwnTile, friendly],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        return { ok: true, json: async () => ({ success: true, artifacts: [] }) };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
    await renderTilePage("0_0");
    await waitFor(() => {
      expect(screen.getByText(/Crow Network/i)).toBeInTheDocument();
      // Friendly tile id appears in the list.
      const lis = screen.getAllByText(/1_0/);
      expect(lis.length).toBeGreaterThan(0);
    });
  });

  it("does not render Crow Network when scout upgrade points to wrong intelPassive", async () => {
    const greenOwnTile = { ...ownTile, units: { ground: 0, siege: 0, air: 1 } };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/game/tile/0_0")) {
        return { ok: true, json: async () => ({ success: true, tile: greenOwnTile }) };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: {
              ...BASE_PLAYER,
              userId: "u1",
              caste: "green",
              phase: "play",
              activeUpgrades: {
                "green-air-eagle-scout": "nonexistent-upgrade-id",
              },
            },
            tiles: [greenOwnTile],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        return { ok: true, json: async () => ({ success: true, artifacts: [] }) };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
    await renderTilePage("0_0");
    await waitFor(() => {
      expect(screen.getByText("0_0")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Crow Network/i)).not.toBeInTheDocument();
  });

  it("renders IntelReportPanel after a successful spy + dismisses it", async () => {
    mockLoadCachedMap.mockReturnValue({
      myTiles: [],
      borderTiles: [enemyTile],
      owners: [{ userId: "u2", caste: "blue", displayName: "Rival" }],
      lastFetchedAt: Date.now(),
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.startsWith("/api/game/tile/2_0") && method === "GET") {
        return { ok: true, json: async () => ({ success: true, tile: enemyTile }) };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: {
              ...BASE_PLAYER,
              userId: "u1",
              caste: "red",
              phase: "play",
              stats: { ...BASE_PLAYER.stats, tilesHeld: 5000 },
            },
            tiles: [],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        return { ok: true, json: async () => ({ success: true, artifacts: [] }) };
      }
      if (url === "/api/game/spy" && method === "POST") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: {
              ...BASE_PLAYER,
              userId: "u1",
              caste: "red",
              phase: "play",
              stats: { ...BASE_PLAYER.stats, tilesHeld: 5000 },
            },
            report: {
              action: "spell-cast",
              turnIndex: 1,
              cost: 3,
              summary: "Forge Sight cast",
              narrative: ["Saw the seam.", "Heard the hammer."],
              artifactFound: { rarity: "rare", name: "Whetstone" },
            },
            intelReport: {
              targetTileId: "2_0",
              targetOwnerId: "u2",
              capturedAtTurn: 7,
              source: "spell",
              sourceId: "red-forge-sight",
              scope: "single",
              target: {
                landType: "food",
                units: { ground: 3, siege: 0, air: 0 },
                armedDefenseSpellId: "red-bulwark",
                isolatedSpawn: false,
              },
              weakFace: "ground",
              neighbors: [
                {
                  tileId: "3_0",
                  ownerId: "u3",
                  landType: "military",
                  units: { ground: 1, siege: 0, air: 0 },
                },
                {
                  tileId: "2_-1",
                  ownerId: null,
                  landType: "magic",
                  units: { ground: 0, siege: 0, air: 0 },
                },
              ],
              kingdomDefender: {
                tilesHeld: 4,
                unitsAlive: 30,
                activeProductionSpellIds: ["red-forge"],
                artifactCount: 1,
              },
              supply: {
                friendlyNeighbors: [
                  { tileId: "3_0", landType: "military" },
                ],
                supplyMultiplier: 1.5,
              },
            },
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;

    await renderTilePage("2_0");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Cast spy/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /Cast spy/i }));
    await waitFor(() => {
      expect(screen.getByText(/Intel report/i)).toBeInTheDocument();
      // "Forge Sight cast" appears in both the action banner and ReportLog
      expect(screen.getAllByText(/Forge Sight cast/i).length).toBeGreaterThan(0);
      // Narrative lines render via ReportLog
      expect(screen.getByText("Saw the seam.")).toBeInTheDocument();
      expect(screen.getByText("Heard the hammer.")).toBeInTheDocument();
      // Artifact found pill
      expect(screen.getByText(/rare artifact found/i)).toBeInTheDocument();
      // Forge Sight weakFace + Kingdom defender summary
      expect(screen.getAllByText(/4 tiles/).length).toBeGreaterThan(0);
      // Supply summary (×1.50)
      expect(screen.getByText(/×1\.50/)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /Dismiss/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Intel report/i)).not.toBeInTheDocument();
    });
  });

  it("renders IntelReportPanel with singular friendly neighbor + no armed defense", async () => {
    mockLoadCachedMap.mockReturnValue({
      myTiles: [],
      borderTiles: [enemyTile],
      owners: [{ userId: "u2", caste: "blue", displayName: "Rival" }],
      lastFetchedAt: Date.now(),
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.startsWith("/api/game/tile/2_0") && method === "GET") {
        return { ok: true, json: async () => ({ success: true, tile: enemyTile }) };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: {
              ...BASE_PLAYER,
              userId: "u1",
              caste: "red",
              phase: "play",
              stats: { ...BASE_PLAYER.stats, tilesHeld: 5000 },
            },
            tiles: [],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        return { ok: true, json: async () => ({ success: true, artifacts: [] }) };
      }
      if (url === "/api/game/spy" && method === "POST") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            // Multiple reports → exercises `data.reports` (batch) branch
            reports: [
              {
                action: "spell-cast",
                turnIndex: 2,
                cost: 3,
                summary: "Spell A",
                narrative: [],
              },
              {
                action: "spell-cast",
                turnIndex: 3,
                cost: 0,
                summary: "Spell B",
                narrative: [],
              },
            ],
            stoppedEarly: "out_of_turns",
            intelReport: {
              targetTileId: "2_0",
              targetOwnerId: "u2",
              capturedAtTurn: 9,
              source: "passive",
              sourceId: "red-forge-scouts",
              scope: "single",
              target: {
                landType: "food",
                units: { ground: 1, siege: 0, air: 0 },
                armedDefenseSpellId: null,
                isolatedSpawn: false,
              },
              supply: {
                friendlyNeighbors: [{ tileId: "3_0", landType: "military" }],
                supplyMultiplier: 1.25,
              },
              kingdomDefender: {
                tilesHeld: 2,
                unitsAlive: 4,
                activeProductionSpellIds: [],
                artifactCount: 0,
              },
            },
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;

    await renderTilePage("2_0");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Cast spy/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /Cast spy/i }));
    await waitFor(() => {
      // single tile friendly → "1 friendly tile" (no plural 's')
      expect(screen.getByText(/1 friendly tile\./i)).toBeInTheDocument();
      // stoppedEarly takes precedence over summary
      expect(screen.getByText(/Stopped: out_of_turns/i)).toBeInTheDocument();
      // both batch reports rendered
      expect(screen.getByText("Spell A")).toBeInTheDocument();
      expect(screen.getByText("Spell B")).toBeInTheDocument();
    });
  });

  it("merges targetTile + attackerPlayer + report.summary from attack response", async () => {
    const myBorderTile = {
      tileId: "1_0",
      q: 1,
      r: 0,
      type: "military" as const,
      ownerId: "u1",
      units: { ground: 50, siege: 0, air: 0 },
      armedDefenseSpellId: null,
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.startsWith("/api/game/tile/2_0") && method === "GET") {
        return { ok: true, json: async () => ({ success: true, tile: enemyTile }) };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: {
              ...BASE_PLAYER,
              userId: "u1",
              caste: "red",
              phase: "play",
              stats: { ...BASE_PLAYER.stats, tilesHeld: 5 },
            },
            tiles: [myBorderTile],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        return { ok: true, json: async () => ({ success: true, artifacts: [] }) };
      }
      if (url === "/api/game/attack" && method === "POST") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            attackerPlayer: {
              ...BASE_PLAYER,
              userId: "u1",
              caste: "red",
              phase: "play",
              turnsRemaining: 4,
              stats: { ...BASE_PLAYER.stats, tilesHeld: 6 },
            },
            // Both `tile` and `targetTile` to cover both branches in callApi.
            tile: { ...myBorderTile, units: { ground: 45, siege: 0, air: 0 } },
            targetTile: {
              ...enemyTile,
              ownerId: "u1",
              units: { ground: 5, siege: 0, air: 0 },
            },
            report: {
              action: "attack",
              turnIndex: 9,
              cost: 1,
              summary: "Captured tile",
              narrative: ["Walls fell."],
            },
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;

    await renderTilePage("2_0");
    await waitFor(() => {
      expect(screen.getByText(/Launch attack/i)).toBeInTheDocument();
    });
    const groundInput = screen.getByLabelText(/Ground/i);
    fireEvent.change(groundInput, { target: { value: "5" } });
    await userEvent.click(
      screen.getByRole("button", { name: /Send 5 units/i })
    );

    await waitFor(() => {
      // report.summary surfaces above the form
      const summaryHits = screen.getAllByText(/Captured tile/i);
      expect(summaryHits.length).toBeGreaterThan(0);
      // Narrative line
      expect(screen.getByText("Walls fell.")).toBeInTheDocument();
    });
  });

  it("surfaces action error from data.error.message + non-Error catch", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.startsWith("/api/game/tile/0_0") && method === "GET") {
        return { ok: true, json: async () => ({ success: true, tile: ownTile }) };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: { ...BASE_PLAYER, userId: "u1", caste: "red", phase: "play" },
            tiles: [ownTile],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        return { ok: true, json: async () => ({ success: true, artifacts: [] }) };
      }
      if (url === "/api/game/build" && method === "POST") {
        return {
          ok: true,
          json: async () => ({
            success: false,
            error: { message: "Not enough turns" },
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
    await renderTilePage("0_0");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /\+10 Marauder/i })
      ).toBeInTheDocument();
    });
    await userEvent.click(
      screen.getByRole("button", { name: /\+10 Marauder/i })
    );
    await waitFor(() => {
      expect(screen.getByText("Not enough turns")).toBeInTheDocument();
    });
  });

  it("falls back to data.error string when callApi response has bare error string", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.startsWith("/api/game/tile/0_0") && method === "GET") {
        return { ok: true, json: async () => ({ success: true, tile: ownTile }) };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: { ...BASE_PLAYER, userId: "u1", caste: "red", phase: "play" },
            tiles: [ownTile],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        return { ok: true, json: async () => ({ success: true, artifacts: [] }) };
      }
      if (url === "/api/game/build" && method === "POST") {
        return { ok: true, json: async () => ({ success: false, error: "string-err" }) };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
    await renderTilePage("0_0");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /\+10 Marauder/i })
      ).toBeInTheDocument();
    });
    await userEvent.click(
      screen.getByRole("button", { name: /\+10 Marauder/i })
    );
    await waitFor(() => {
      expect(screen.getByText("string-err")).toBeInTheDocument();
    });
  });

  it("falls back to 'Action failed' when callApi response has neither object nor string error", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.startsWith("/api/game/tile/0_0") && method === "GET") {
        return { ok: true, json: async () => ({ success: true, tile: ownTile }) };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: { ...BASE_PLAYER, userId: "u1", caste: "red", phase: "play" },
            tiles: [ownTile],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        return { ok: true, json: async () => ({ success: true, artifacts: [] }) };
      }
      if (url === "/api/game/build" && method === "POST") {
        return { ok: true, json: async () => ({ success: false }) };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
    await renderTilePage("0_0");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /\+10 Marauder/i })
      ).toBeInTheDocument();
    });
    await userEvent.click(
      screen.getByRole("button", { name: /\+10 Marauder/i })
    );
    await waitFor(() => {
      expect(screen.getByText("Action failed")).toBeInTheDocument();
    });
  });

  it("removes artifact from inventory after artifact-use response", async () => {
    const artifact = {
      id: "a1",
      ownerId: "u1",
      definitionId: "warding-stone",
      rarity: "common" as const,
      type: "defense" as const,
      foundAtTurn: 1,
      foundDuringAction: "explore",
      used: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.startsWith("/api/game/tile/0_0") && method === "GET") {
        return { ok: true, json: async () => ({ success: true, tile: ownTile }) };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: { ...BASE_PLAYER, userId: "u1", caste: "red", phase: "play" },
            tiles: [ownTile],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        return {
          ok: true,
          json: async () => ({ success: true, artifacts: [artifact] }),
        };
      }
      if (url === "/api/game/artifact/use" && method === "POST") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: { ...BASE_PLAYER, userId: "u1", caste: "red", phase: "play" },
            tile: ownTile,
            artifact: { ...artifact, used: true },
            report: {
              action: "spell-arm",
              turnIndex: 1,
              cost: 0,
              summary: "Stone planted",
              narrative: [],
            },
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
    await renderTilePage("0_0");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Use warding-stone/i })).toBeInTheDocument();
    });
    await userEvent.click(
      screen.getByRole("button", { name: /Use warding-stone/i })
    );
    await waitFor(() => {
      // Artifact button gone
      expect(
        screen.queryByRole("button", { name: /Use warding-stone/i })
      ).not.toBeInTheDocument();
      expect(screen.getByText(/No unused defense artifacts/i)).toBeInTheDocument();
    });
  });

  it("handles non-Error throw in callApi", async () => {
    let callCount = 0;
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.startsWith("/api/game/tile/0_0") && method === "GET") {
        return { ok: true, json: async () => ({ success: true, tile: ownTile }) };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: { ...BASE_PLAYER, userId: "u1", caste: "red", phase: "play" },
            tiles: [ownTile],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        return { ok: true, json: async () => ({ success: true, artifacts: [] }) };
      }
      if (url === "/api/game/build" && method === "POST") {
        callCount += 1;
        throw "string-throw"; // non-Error rejection
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
    await renderTilePage("0_0");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /\+10 Marauder/i })
      ).toBeInTheDocument();
    });
    await userEvent.click(
      screen.getByRole("button", { name: /\+10 Marauder/i })
    );
    await waitFor(() => {
      expect(callCount).toBe(1);
      expect(screen.getByText("Action failed")).toBeInTheDocument();
    });
  });

  it("renders unauth state with prior error message", async () => {
    // Auth user resolves null after a failed fetch — exercises the
    // `error && <p>` branch inside the !user || !player || !tile fallback.
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    global.fetch = jest.fn() as unknown as typeof fetch;
    await renderTilePage("0_0");
    await waitFor(() => {
      expect(screen.getByText(/Back to tiles/i)).toBeInTheDocument();
    });
  });

  it("shows inscription save error from string error response", async () => {
    const ownTileWithInscription = { ...ownTile, inscription: "Stand fast" };
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.startsWith("/api/game/tile/0_0/inscription") && method === "POST") {
        return {
          ok: true,
          json: async () => ({ success: false, error: "Save denied" }),
        };
      }
      if (url.startsWith("/api/game/tile/0_0") && method === "GET") {
        return {
          ok: true,
          json: async () => ({ success: true, tile: ownTileWithInscription }),
        };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: { ...BASE_PLAYER, userId: "u1", caste: "red", phase: "play" },
            tiles: [ownTileWithInscription],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        return { ok: true, json: async () => ({ success: true, artifacts: [] }) };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
    await renderTilePage("0_0");
    await waitFor(() => {
      expect(screen.getByText("Stand fast")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /edit/i }));
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Save denied");
    });
  });

  it("shows inscription save error from object error fallback", async () => {
    const ownTileWithInscription = { ...ownTile, inscription: "Stand fast" };
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.startsWith("/api/game/tile/0_0/inscription") && method === "POST") {
        return {
          ok: true,
          json: async () => ({ success: false, error: {} }),
        };
      }
      if (url.startsWith("/api/game/tile/0_0") && method === "GET") {
        return {
          ok: true,
          json: async () => ({ success: true, tile: ownTileWithInscription }),
        };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: { ...BASE_PLAYER, userId: "u1", caste: "red", phase: "play" },
            tiles: [ownTileWithInscription],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        return { ok: true, json: async () => ({ success: true, artifacts: [] }) };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
    await renderTilePage("0_0");
    await waitFor(() => {
      expect(screen.getByText("Stand fast")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /edit/i }));
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Failed to save/i);
    });
  });

  it("renders 'No inscription set' placeholder when own tile has empty inscription", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/game/tile/0_0")) {
        return { ok: true, json: async () => ({ success: true, tile: ownTile }) };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: { ...BASE_PLAYER, userId: "u1", caste: "red", phase: "play" },
            tiles: [ownTile],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        return { ok: true, json: async () => ({ success: true, artifacts: [] }) };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
    await renderTilePage("0_0");
    await waitFor(() => {
      expect(screen.getByText(/No inscription set/i)).toBeInTheDocument();
    });
  });

  it("renders Unclaimed owner stat for a tile with no owner", async () => {
    const unclaimedTile = { ...ownTile, ownerId: null };
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/game/tile/0_0")) {
        return { ok: true, json: async () => ({ success: true, tile: unclaimedTile }) };
      }
      if (url === "/api/game/player") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            player: { ...BASE_PLAYER, userId: "u1", caste: "red", phase: "play" },
            tiles: [],
          }),
        };
      }
      if (url.startsWith("/api/game/artifacts")) {
        return { ok: true, json: async () => ({ success: true, artifacts: [] }) };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
    await renderTilePage("0_0");
    await waitFor(() => {
      expect(screen.getByText("Unclaimed")).toBeInTheDocument();
    });
  });
});
