/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { BattleSimPanel } from "@/app/game/threats/_components/BattleSimPanel";
import type { AttackPreview } from "@/app/game/threats/_lib/use-attack-preview";
import { ALL_SPELLS } from "@/lib/game/content";

jest.mock("@/app/game/_components/CatalogImage", () => ({
  CatalogImage: () => <div data-testid="catalog-image" />,
}));
jest.mock("@/app/game/_components/CatalogLore", () => ({
  CatalogLore: ({ entry }: { entry: { id: string } }) => (
    <div data-testid={`lore-${entry.id}`} />
  ),
}));

const offenseSpell =
  ALL_SPELLS.find((s) => s.type === "offense") ?? ALL_SPELLS[0]!;
const defenseSpell =
  ALL_SPELLS.find((s) => s.type === "defense") ?? ALL_SPELLS[0]!;

function makePreview(overrides: Partial<AttackPreview["combat"]> = {}): AttackPreview {
  return {
    combat: {
      outcome: "captured",
      attackPower: 120,
      defensePower: 80,
      attackerLosses: { ground: 1, siege: 0, air: 0 },
      defenderLosses: { ground: 2, siege: 0, air: 0 },
      sourceLandTypeMultiplier: 1.1,
      targetLandTypeMultiplier: 0.9,
      standingDefenseAdded: 5,
      supplyMultiplier: 1.2,
      appliedSpells: {
        offenseId: offenseSpell.id,
        defenseId: defenseSpell.id,
      },
      ...overrides,
    },
    source: {
      tileId: "0_0",
      q: 0,
      r: 0,
      type: "military",
      ownerId: "u1",
      units: { ground: 5, siege: 0, air: 0 },
      armedDefenseSpellId: null,
    },
    target: {
      tileId: "1_0",
      q: 1,
      r: 0,
      type: "food",
      ownerId: "u2",
      units: { ground: 3, siege: 1, air: 0 },
      baseUnits: { ground: 1, siege: 0, air: 0 },
      armedDefenseSpellId: null,
    },
    defender: {
      userId: "u2",
      displayName: "Rival",
      caste: "blue",
      shielded: false,
    },
    effects: {
      forgeSightOffenseBonus: 0.15,
      alertVsCasterDefenseBonus: 0.1,
      siegeDebuffMagnitude: 0.2,
      preCastOffenseBonus: 12,
      defenseDisarmFraction: 0.25,
    },
  };
}

describe("BattleSimPanel", () => {
  it("shows disabled, loading, error, and empty states", () => {
    const { rerender } = render(
      <BattleSimPanel preview={null} loading={false} error={null} disabled disabledReason="Shielded" />,
    );
    expect(screen.getByText("Shielded")).toBeInTheDocument();

    rerender(<BattleSimPanel preview={null} loading error={null} />);
    expect(screen.getByText(/Computing projection/i)).toBeInTheDocument();

    rerender(<BattleSimPanel preview={null} loading={false} error="rate limited" />);
    expect(screen.getByText(/Preview failed: rate limited/i)).toBeInTheDocument();

    rerender(<BattleSimPanel preview={null} loading={false} error={null} />);
    expect(screen.getByText(/Select units to see/i)).toBeInTheDocument();
  });

  it("renders captured outcome with modifiers and prep effects", () => {
    render(
      <BattleSimPanel
        preview={makePreview()}
        loading={false}
        error={null}
        selectedOffenseSpell={{ spell: offenseSpell, expectedMagnitude: 18.4 }}
      />,
    );

    expect(screen.getByText(/Projected: Captured/i)).toBeInTheDocument();
    expect(screen.getByText(/Forge Sight/i)).toBeInTheDocument();
    expect(screen.getByText(/Source tile/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Offense spell/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/~\+18 atk power/i)).toBeInTheDocument();
  });

  it("renders repelled and stalemate banners", () => {
    const { rerender } = render(
      <BattleSimPanel preview={makePreview({ outcome: "repelled" })} loading={false} error={null} />,
    );
    expect(screen.getByText(/Projected: Repelled/i)).toBeInTheDocument();

    rerender(
      <BattleSimPanel preview={makePreview({ outcome: "stalemate" })} loading={false} error={null} />,
    );
    expect(screen.getByText(/Projected: Stalemate/i)).toBeInTheDocument();
  });

  it("omits modifier block when multipliers are neutral", () => {
    render(
      <BattleSimPanel
        preview={makePreview({
          sourceLandTypeMultiplier: 1,
          targetLandTypeMultiplier: 1,
          standingDefenseAdded: 0,
          supplyMultiplier: 1,
          appliedSpells: {},
        })}
        loading={false}
        error={null}
      />,
    );
    expect(screen.queryByText(/Modifiers \(this projection\)/i)).not.toBeInTheDocument();
  });
});
