/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useTilesData } from "@/app/game/tiles/_lib/use-tiles-data";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";
import type { MapTile } from "@/lib/game/types";

jest.mock("@/app/game/tiles/_lib/use-tiles-data", () => ({
  useTilesData: jest.fn(),
}));

jest.mock("@/app/game/tiles/_components/MapCanvas", () => ({
  MapCanvas: ({
    onTileClick,
    visibleTiles,
  }: {
    onTileClick: (tile: MapTile) => void;
    visibleTiles: MapTile[];
  }) => (
    <motionless-map>
      {visibleTiles.map((tile) => (
        <button
          key={tile.tileId}
          type="button"
          onClick={() => onTileClick(tile)}
        >
          {tile.tileId}
        </button>
      ))}
    </motionless-map>
  ),
}));

jest.mock("@/app/game/tiles/_components/TileActionsModal", () => ({
  TileActionsModal: ({ tile, onClose }: { tile: MapTile; onClose: () => void }) => (
    <motionless-modal>
      <span>Modal for {tile.tileId}</span>
      <button type="button" onClick={onClose}>
        Close modal
      </button>
    </motionless-modal>
  ),
}));

jest.mock("@/lib/game/local-map-cache", () => ({
  mayRefresh: jest.fn(() => true),
  msUntilRefresh: jest.fn(() => 0),
  mergeTilesIntoCache: jest.fn(() => null),
}));

const mockUseTilesData = useTilesData as jest.Mock;

const player = {
  userId: "u1",
  displayName: "You",
  caste: "red",
  phase: "play",
  turnsRemaining: 3,
  stats: { tilesHeld: 2, unitsAlive: 10 },
};

const ownTile: MapTile = {
  tileId: "0_0",
  q: 0,
  r: 0,
  type: "military",
  ownerId: "u1",
  units: { ground: 5, siege: 0, air: 0 },
  armedDefenseSpellId: null,
};

const enemyTile: MapTile = {
  tileId: "1_0",
  q: 1,
  r: 0,
  type: "food",
  ownerId: "u2",
  units: { ground: 2, siege: 0, air: 0 },
  armedDefenseSpellId: null,
};

const frontierTile: MapTile = {
  tileId: "2_0",
  q: 2,
  r: 0,
  type: "unassigned",
  ownerId: null,
  units: { ground: 0, siege: 0, air: 0 },
  armedDefenseSpellId: null,
};

function baseData(overrides: Record<string, unknown> = {}) {
  const ownersById = new Map([
    ["u2", { userId: "u2", displayName: "Rival", caste: "white", shielded: false, isNpc: false }],
    ["npc-1", { userId: "npc-1", displayName: "NPC", caste: "black", shielded: false, isNpc: true }],
  ]);
  return {
    user: makeAuthUser("u1"),
    authLoading: false,
    player,
    setPlayer: jest.fn(),
    cachedView: null,
    setCachedView: jest.fn(),
    worldView: null,
    mode: "personal" as const,
    setMode: jest.fn(),
    loading: false,
    refreshing: false,
    worldError: null,
    tiles: [ownTile, enemyTile, frontierTile],
    ownersById,
    refreshPersonalMap: jest.fn(),
    fetchWorldOnce: jest.fn(),
    liveConnected: false,
    ...overrides,
  };
}

describe("game tiles map page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTilesData.mockReturnValue(baseData());
  });

  it("shows a spinner while loading", async () => {
    mockUseTilesData.mockReturnValue(
      baseData({ authLoading: true, user: null, player: null }),
    );
    const Page = (await import("@/app/game/tiles/page")).default;
    const { container } = render(<Page />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("prompts signed-out users to return to the dashboard", async () => {
    mockUseTilesData.mockReturnValue(
      baseData({ user: null, player: null }),
    );
    const Page = (await import("@/app/game/tiles/page")).default;
    render(<Page />);
    expect(screen.getByRole("link", { name: /Go to dashboard/i })).toHaveAttribute(
      "href",
      "/game",
    );
  });

  it("renders the map and opens a tile actions modal", async () => {
    const Page = (await import("@/app/game/tiles/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText("World map")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "0_0" }));
    expect(screen.getByText("Modal for 0_0")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close modal" }));
    await waitFor(() => {
      expect(screen.queryByText("Modal for 0_0")).not.toBeInTheDocument();
    });
  });

  it("shows world fetch errors with retry in world mode", async () => {
    const fetchWorldOnce = jest.fn();
    mockUseTilesData.mockReturnValue(
      baseData({
        mode: "world",
        worldError: "Upstream timeout",
        fetchWorldOnce,
      }),
    );
    const Page = (await import("@/app/game/tiles/page")).default;
    render(<Page />);

    expect(screen.getByText(/World fetch failed/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/i }));
    expect(fetchWorldOnce).toHaveBeenCalled();
  });

  it("shows an empty-state message when there are no tiles", async () => {
    mockUseTilesData.mockReturnValue(baseData({ tiles: [] }));
    const Page = (await import("@/app/game/tiles/page")).default;
    render(<Page />);
    expect(screen.getByText(/world is empty/i)).toBeInTheDocument();
  });
});
