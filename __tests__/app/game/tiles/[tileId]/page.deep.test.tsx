/**
 * @jest-environment jsdom
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
  useAttackPreview: () => ({
    preview: { attackerWins: true },
    loading: false,
    error: null,
  }),
}));

jest.mock("@/app/game/threats/_components/BattleSimPanel", () => ({
  BattleSimPanel: ({ disabledReason }: { disabledReason?: string }) => (
    <div data-testid="battle-sim">{disabledReason ?? "ready"}</div>
  ),
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
  units: { ground: 10, siege: 0, air: 0 },
  armedDefenseSpellId: null,
  inscription: "Hold the line",
};

const borderTile = {
  tileId: "1_0",
  q: 1,
  r: 0,
  type: "military" as const,
  ownerId: "u1",
  units: { ground: 8, siege: 0, air: 0 },
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
  inscription: "Enemy words",
};

function stubFetchForTile(tile = ownTile) {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.startsWith(`/api/game/tile/${encodeURIComponent(tile.tileId)}`) && method === "GET") {
      return { ok: true, json: async () => ({ success: true, tile }) };
    }
    if (url.startsWith(`/api/game/tile/${tile.tileId}/inscription`) && method === "POST") {
      const body = JSON.parse(String(init?.body)) as { inscription: string };
      return {
        ok: true,
        json: async () => ({
          success: true,
          tile: { ...tile, inscription: body.inscription },
        }),
      };
    }
    if (url === "/api/game/player") {
      const owned = tile.ownerId === "u1" ? [tile] : [borderTile];
      return {
        ok: true,
        json: async () => ({
          success: true,
          player: {
            ...BASE_PLAYER,
            userId: "u1",
            caste: "red",
            phase: "play",
            turnsRemaining: 10,
            stats: { ...BASE_PLAYER.stats, tilesHeld: 5 },
          },
          tiles: owned,
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
          report: {
            action: "attack",
            turnIndex: 1,
            cost: 1,
            summary: "Attack launched",
            narrative: [],
          },
        }),
      };
    }
    if (url === "/api/game/build" && method === "POST") {
      return {
        ok: true,
        json: async () => ({
          success: true,
          player: {
            ...BASE_PLAYER,
            userId: "u1",
            caste: "red",
            phase: "play",
          },
          tile: { ...tile, units: { ...tile.units, ground: tile.units.ground + 10 } },
          report: {
            action: "build",
            turnIndex: 1,
            cost: 5,
            summary: "Built ground units",
            narrative: [],
          },
        }),
      };
    }
    return { ok: true, json: async () => ({ success: true }) };
  }) as typeof fetch;
}

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

describe("game tile detail page (deep)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      loading: false,
    });
    mockLoadCachedMap.mockReturnValue({
      borderTiles: [enemyTile],
      owners: [
        { userId: "u2", caste: "blue", displayName: "Rival" },
      ],
      lastFetchedAt: Date.now(),
    });
  });

  it("shows and saves tile inscription on owned tiles", async () => {
    stubFetchForTile(ownTile);
    await renderTilePage("0_0");

    await waitFor(() => {
      expect(screen.getByText("Hold the line")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /edit/i }));
    const textarea = screen.getByPlaceholderText(/short inscription/i);
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Updated motto");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/game/tile/0_0/inscription",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ inscription: "Updated motto" }),
        })
      );
    });
  });

  it("cancels inscription edits without saving", async () => {
    stubFetchForTile(ownTile);
    await renderTilePage("0_0");

    await waitFor(() => {
      expect(screen.getByText("Hold the line")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /edit/i }));
    const textarea = screen.getByPlaceholderText(/short inscription/i);
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Temporary");
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.getByText("Hold the line")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Temporary")).not.toBeInTheDocument();
  });

  it("shows enemy inscription read-only", async () => {
    stubFetchForTile(enemyTile);
    await renderTilePage("2_0");

    await waitFor(() => {
      expect(screen.getByText("Enemy words")).toBeInTheDocument();
      expect(screen.getByText("Enemy")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("renders attack panel and submits an attack from a bordering tile", async () => {
    stubFetchForTile(enemyTile);
    await renderTilePage("2_0");

    await waitFor(() => {
      expect(screen.getByText(/Launch attack/i)).toBeInTheDocument();
    });

    expect(screen.getByTestId("battle-sim")).toBeInTheDocument();

    const groundInput = screen.getByLabelText(/Ground/i);
    fireEvent.change(groundInput, { target: { value: "2" } });

    await userEvent.click(
      screen.getByRole("button", { name: /Send 2 units/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/game/attack",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"targetTileId":"2_0"'),
        })
      );
      expect(screen.getAllByText(/Attack launched/i).length).toBeGreaterThan(0);
    });
  });

  it("builds units on an owned military tile", async () => {
    stubFetchForTile(ownTile);
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
      const buildCall = (global.fetch as jest.Mock).mock.calls.find(
        ([url, init]) =>
          String(url) === "/api/game/build" &&
          (init as RequestInit | undefined)?.method === "POST"
      );
      expect(buildCall).toBeTruthy();
      expect(JSON.parse(String(buildCall![1]?.body))).toEqual({
        tileId: "0_0",
        unitType: "ground",
      });
      expect(screen.getByText("20")).toBeInTheDocument();
    });
  });

  it("assigns a new land type on an owned tile", async () => {
    stubFetchForTile(ownTile);
    await renderTilePage("0_0");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Food$/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /^Food$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/game/setup/distribute",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ tileId: "0_0", type: "food" }),
        })
      );
    });
  });
});
