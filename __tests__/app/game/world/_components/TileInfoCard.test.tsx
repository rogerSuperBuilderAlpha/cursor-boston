/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { TileInfoCard } from "@/app/game/world/_components/TileInfoCard";
import type { World3DTile } from "@/lib/game/world-snapshot-3d";

const CASTE_COLOR_HEX = {
  black: 0x4b3f5c,
  red: 0xd0463a,
  white: 0xe6e6e6,
  green: 0x4caf50,
  blue: 0x4f8cf6,
};
const CASTE_LABEL = {
  black: "Black",
  red: "Red",
  white: "White",
  green: "Green",
  blue: "Blue",
};

function tile(overrides: Partial<World3DTile> = {}): World3DTile {
  return {
    tileId: "tile-1",
    q: 0,
    r: 0,
    type: "military",
    ownerId: "user-abc",
    ownerName: "Ada",
    caste: "green",
    isNpc: false,
    level: 2,
    hasExtraForces: false,
    hasHero: false,
    ownerShielded: false,
    ...overrides,
  };
}

describe("TileInfoCard", () => {
  const noop = () => undefined;

  it("renders owner name + tile id + caste + land + level", () => {
    render(
      <TileInfoCard
        tile={tile()}
        signedIn={true}
        onClose={noop}
        casteColorHex={CASTE_COLOR_HEX}
        casteLabel={CASTE_LABEL}
      />
    );
    expect(screen.getByText(/Tile tile-1/)).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Green")).toBeInTheDocument();
    expect(screen.getByText("Military")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Base garrison only")).toBeInTheDocument();
  });

  it("annotates the owner label with (NPC) for NPC-held tiles", () => {
    render(
      <TileInfoCard
        tile={tile({ ownerName: "Dame Orla", isNpc: true })}
        signedIn={true}
        onClose={noop}
        casteColorHex={CASTE_COLOR_HEX}
        casteLabel={CASTE_LABEL}
      />
    );
    expect(screen.getByText("Dame Orla (NPC)")).toBeInTheDocument();
  });

  it("labels unowned tiles as 'Unclaimed'", () => {
    render(
      <TileInfoCard
        tile={tile({ ownerName: null, ownerId: null, caste: null })}
        signedIn={true}
        onClose={noop}
        casteColorHex={CASTE_COLOR_HEX}
        casteLabel={CASTE_LABEL}
      />
    );
    expect(screen.getByText("Unclaimed")).toBeInTheDocument();
    // Em-dash for the caste row when there is no caste.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows 'Yes' for tiles with extra forces", () => {
    render(
      <TileInfoCard
        tile={tile({ hasExtraForces: true })}
        signedIn={true}
        onClose={noop}
        casteColorHex={CASTE_COLOR_HEX}
        casteLabel={CASTE_LABEL}
      />
    );
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("shows 'Stationed' for tiles with a hero", () => {
    render(
      <TileInfoCard
        tile={tile({ hasHero: true })}
        signedIn={true}
        onClose={noop}
        casteColorHex={CASTE_COLOR_HEX}
        casteLabel={CASTE_LABEL}
      />
    );
    expect(screen.getByText("Stationed")).toBeInTheDocument();
  });

  it("renders an Active shield row only when ownerShielded is true", () => {
    const { rerender } = render(
      <TileInfoCard
        tile={tile({ ownerShielded: false })}
        signedIn={true}
        onClose={noop}
        casteColorHex={CASTE_COLOR_HEX}
        casteLabel={CASTE_LABEL}
      />
    );
    expect(screen.queryByText("Shield")).not.toBeInTheDocument();
    rerender(
      <TileInfoCard
        tile={tile({ ownerShielded: true })}
        signedIn={true}
        onClose={noop}
        casteColorHex={CASTE_COLOR_HEX}
        casteLabel={CASTE_LABEL}
      />
    );
    expect(screen.getByText("Shield")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows the Sign-in CTA when signedIn is false", () => {
    render(
      <TileInfoCard
        tile={tile()}
        signedIn={false}
        onClose={noop}
        casteColorHex={CASTE_COLOR_HEX}
        casteLabel={CASTE_LABEL}
      />
    );
    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("hides the Sign-in CTA when signedIn is true", () => {
    render(
      <TileInfoCard
        tile={tile()}
        signedIn={true}
        onClose={noop}
        casteColorHex={CASTE_COLOR_HEX}
        casteLabel={CASTE_LABEL}
      />
    );
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("calls onClose when the × button is clicked", () => {
    const onClose = jest.fn();
    render(
      <TileInfoCard
        tile={tile()}
        signedIn={true}
        onClose={onClose}
        casteColorHex={CASTE_COLOR_HEX}
        casteLabel={CASTE_LABEL}
      />
    );
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
