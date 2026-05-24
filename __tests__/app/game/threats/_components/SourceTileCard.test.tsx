/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { SourceTileCard } from "@/app/game/threats/_components/SourceTileCard";
import type { MapTile } from "@/lib/game/types";

jest.mock("@/app/game/_components/CatalogImage", () => ({
  CatalogImage: () => <div data-testid="catalog-image" />,
}));

function makeTile(overrides: Partial<MapTile> = {}): MapTile {
  return {
    tileId: "0_0",
    q: 0,
    r: 0,
    type: "military",
    ownerId: "u1",
    units: { ground: 5, siege: 2, air: 1 },
    baseUnits: { ground: 3, siege: 1, air: 0 },
    armedDefenseSpellId: null,
    ...overrides,
  };
}

describe("SourceTileCard", () => {
  const noop = () => undefined;

  it("renders the tile id, building name, and combined unit counts", () => {
    render(
      <SourceTileCard
        source={makeTile()}
        myCaste="red"
        candidateCount={1}
        isBest={false}
        onOpenPicker={noop}
      />
    );
    expect(screen.getByText("0_0")).toBeInTheDocument();
    // BASE+SUPER: ground=5+3, siege=2+1, air=1+0
    expect(screen.getByText(/G8 · S3 · A1/)).toBeInTheDocument();
    expect(screen.getByText("(12)")).toBeInTheDocument();
  });

  it("falls back to the tile.type label when no caste building matches", () => {
    render(
      <SourceTileCard
        source={makeTile({ type: "unassigned" })}
        myCaste="red"
        candidateCount={1}
        isBest={false}
        onOpenPicker={noop}
      />
    );
    expect(screen.getByText("unassigned")).toBeInTheDocument();
  });

  it("shows the ✨ best badge when isBest=true", () => {
    render(
      <SourceTileCard
        source={makeTile()}
        myCaste="red"
        candidateCount={2}
        isBest={true}
        onOpenPicker={noop}
      />
    );
    expect(screen.getByText(/best/)).toBeInTheDocument();
  });

  it("disables the Change button when only one candidate borders the enemy", () => {
    render(
      <SourceTileCard
        source={makeTile()}
        myCaste="red"
        candidateCount={1}
        isBest={false}
        onOpenPicker={noop}
      />
    );
    const change = screen.getByRole("button", { name: /Change/ });
    expect(change).toBeDisabled();
    expect(change).toHaveAttribute(
      "title",
      "Only one of your tiles borders this enemy."
    );
  });

  it("enables Change and shows the candidate count when there are alternatives", () => {
    render(
      <SourceTileCard
        source={makeTile()}
        myCaste="red"
        candidateCount={3}
        isBest={false}
        onOpenPicker={noop}
      />
    );
    const change = screen.getByRole("button", { name: /Change/ });
    expect(change).not.toBeDisabled();
    expect(screen.getByText("(3)")).toBeInTheDocument();
  });

  it("invokes onOpenPicker when Change is clicked", () => {
    const onOpenPicker = jest.fn();
    render(
      <SourceTileCard
        source={makeTile()}
        myCaste="red"
        candidateCount={3}
        isBest={false}
        onOpenPicker={onOpenPicker}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Change/ }));
    expect(onOpenPicker).toHaveBeenCalledTimes(1);
  });

  it("treats missing baseUnits as zeros", () => {
    render(
      <SourceTileCard
        source={makeTile({ baseUnits: undefined })}
        myCaste="red"
        candidateCount={1}
        isBest={false}
        onOpenPicker={noop}
      />
    );
    // units only: ground=5, siege=2, air=1
    expect(screen.getByText(/G5 · S2 · A1/)).toBeInTheDocument();
  });
});
