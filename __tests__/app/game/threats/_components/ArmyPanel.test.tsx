/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { ArmyPanel } from "@/app/game/threats/_components/ArmyPanel";
import type { GamePlayer } from "@/lib/game/types";

jest.mock("@/app/game/_components/CatalogImage", () => ({
  CatalogImage: () => <div data-testid="catalog-image" />,
}));

function makePlayer(overrides: Partial<GamePlayer> = {}): GamePlayer {
  return {
    userId: "u1",
    displayName: "Test General",
    caste: "red",
    turnsRemaining: 100,
    turnsSpentTotal: 0,
    phase: "play",
    tilesExplored: 0,
    shieldUntil: { toMillis: () => 0 } as never,
    shieldDropAtTurn: 0,
    stats: { attacksWon: 0, attacksLost: 0, tilesHeld: 0, unitsAlive: 0 },
    productionSpellsActive: [],
    activeUpgrades: {},
    ...overrides,
  } as GamePlayer;
}

describe("ArmyPanel", () => {
  it("returns null when the player has no caste", () => {
    const { container } = render(<ArmyPanel player={makePlayer({ caste: null })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the header with the player's caste label", () => {
    render(<ArmyPanel player={makePlayer({ caste: "blue" })} />);
    expect(screen.getByText(/🪖 Your army/)).toBeInTheDocument();
    expect(screen.getByText(/blue caste/)).toBeInTheDocument();
  });

  it("renders both Units and Buildings sections by default", () => {
    render(<ArmyPanel player={makePlayer({ caste: "red" })} />);
    expect(screen.getByText("Units")).toBeInTheDocument();
    expect(screen.getByText("Tiles & buildings")).toBeInTheDocument();
  });

  it("toggles open/closed when the header button is clicked", () => {
    render(<ArmyPanel player={makePlayer({ caste: "red" })} />);
    const toggle = screen.getByRole("button", { expanded: true });
    expect(screen.getByText("Units")).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByText("Units")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByText("Units")).toBeInTheDocument();
  });

  it("shows 'no upgrade picked' when the active-upgrades map is empty", () => {
    render(<ArmyPanel player={makePlayer({ caste: "red", activeUpgrades: {} })} />);
    expect(screen.getAllByText("no upgrade picked").length).toBeGreaterThan(0);
  });

  it("renders one image per unit and building card", () => {
    render(<ArmyPanel player={makePlayer({ caste: "red" })} />);
    // Each caste ships 3 units + 3 buildings = 6 cards minimum.
    expect(screen.getAllByTestId("catalog-image").length).toBeGreaterThanOrEqual(6);
  });
});
