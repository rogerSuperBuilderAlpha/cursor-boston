/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/AuthContext";
import { TileActionsModal } from "@/app/game/tiles/_components/TileActionsModal";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";
import { BASE_PLAYER } from "@/__tests__/_helpers/game-mutation-db";
import { STAMINA_CONVERSION_THRESHOLD } from "@/lib/game/content/heroes";

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

const player = {
  ...BASE_PLAYER,
  userId: "u1",
  caste: "red" as const,
  phase: "play" as const,
  turnsRemaining: 8,
};

const ownTile = {
  tileId: "0_0",
  q: 0,
  r: 0,
  type: "military" as const,
  ownerId: "u1",
  units: { ground: 5, siege: 0, air: 0 },
  armedDefenseSpellId: "red-shield-1" as string | null,
};

const foreignTileWithHero = {
  tileId: "1_0",
  q: 1,
  r: 0,
  type: "food" as const,
  ownerId: "u2",
  units: { ground: 2, siege: 0, air: 0 },
  armedDefenseSpellId: null,
  hero: {
    heroId: "h1",
    name: "Aldric",
    class: "military" as const,
    specialty: "siege-breaker" as const,
    stamina: 10,
    staminaMax: 100,
    ownerId: "u2",
    tileId: "1_0",
  },
};

function renderModal(
  tile: typeof ownTile | typeof foreignTileWithHero,
  overrides: Partial<{
    ownerName: string | null;
    onClose: jest.Mock;
    onTileUpdate: jest.Mock;
    onPlayerUpdate: jest.Mock;
  }> = {},
) {
  const onClose = overrides.onClose ?? jest.fn();
  const onTileUpdate = overrides.onTileUpdate ?? jest.fn();
  const onPlayerUpdate = overrides.onPlayerUpdate ?? jest.fn();
  return {
    onClose,
    onTileUpdate,
    onPlayerUpdate,
    ...render(
      <TileActionsModal
        tile={tile}
        player={player}
        ownedTiles={[ownTile]}
        ownerName={overrides.ownerName ?? "Rival"}
        onClose={onClose}
        onTileUpdate={onTileUpdate}
        onPlayerUpdate={onPlayerUpdate}
      />,
    ),
  };
}

describe("TileActionsModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      loading: false,
    });
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ success: true, player, tile: ownTile }),
    }) as typeof fetch;
  });

  it("renders own tile label and closes on backdrop or Escape", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal(ownTile);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/yours · military/i)).toBeInTheDocument();
    expect(screen.getByText(/red-shield-1/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Manage caste upgrades/i })).toHaveAttribute(
      "href",
      "/game/upgrades",
    );

    await user.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("calls build API from own tile panel", async () => {
    const user = userEvent.setup();
    renderModal(ownTile);

    await user.click(screen.getByRole("button", { name: /\+10 Marauder/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/game/build",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ tileId: "0_0", unitType: "ground" }),
        }),
      );
    });
  });

  it("shows API error message when action fails", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ success: false, error: { message: "Not enough turns" } }),
    });
    renderModal(ownTile);

    await user.click(screen.getByRole("button", { name: /\+10 Marauder/i }));

    expect(await screen.findByText("Not enough turns")).toBeInTheDocument();
  });

  it("renders foreign tile with hero combat choices", async () => {
    const user = userEvent.setup();
    renderModal(foreignTileWithHero, { ownerName: "Rival" });

    expect(screen.getByText(/held by Rival/i)).toBeInTheDocument();
    expect(screen.getByText(/Aldric/i)).toBeInTheDocument();
    expect(screen.getByText(/If you win this combat/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Attempt conversion/i }));
    expect(screen.getByText(/If conversion fails/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^spare$/i }));
  });

  it("disables convert when hero stamina is above threshold", () => {
    renderModal({
      ...foreignTileWithHero,
      hero: {
        ...foreignTileWithHero.hero!,
        stamina: STAMINA_CONVERSION_THRESHOLD + 5,
      },
    });

    expect(screen.getByRole("button", { name: /Attempt conversion/i })).toBeDisabled();
  });

  it("shows stopped-early success message", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        success: true,
        player,
        stoppedEarly: "out of turns",
      }),
    });
    renderModal(ownTile);

    await user.click(screen.getByRole("button", { name: /\+10 Marauder/i }));

    expect(await screen.findByText(/Stopped: out of turns/i)).toBeInTheDocument();
  });

  it("skips fetch when user is not signed in", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    const user = userEvent.setup();
    renderModal(ownTile);

    await user.click(screen.getByRole("button", { name: /\+10 Marauder/i }));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
