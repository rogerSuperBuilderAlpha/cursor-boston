/**
 * @jest-environment jsdom
 *
 * Coverage push: app/game/world was 9.1% before this batch (243 src
 * lines, mostly the 3D scene which is hard to unit-test). The four
 * non-WebGL components — drawer, info card, page shell, client
 * wrapper — get full unit coverage here.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { HowToPlayDrawer } from "@/app/game/world/_components/HowToPlayDrawer";

describe("HowToPlayDrawer", () => {
  it("renders the drawer heading and all four content sections", () => {
    render(<HowToPlayDrawer open={true} onClose={() => undefined} />);
    expect(
      screen.getByRole("heading", { name: "How to read this map" })
    ).toBeInTheDocument();
    expect(screen.getByText("Tile types")).toBeInTheDocument();
    expect(screen.getByText("Castes")).toBeInTheDocument();
    expect(screen.getByText("Markers")).toBeInTheDocument();
    expect(screen.getByText("How turns work")).toBeInTheDocument();
  });

  it("renders the three tile-type legend entries", () => {
    render(<HowToPlayDrawer open={true} onClose={() => undefined} />);
    expect(screen.getByText(/military tile, recruits units/)).toBeInTheDocument();
    expect(screen.getByText(/food tile, feeds armies/)).toBeInTheDocument();
    expect(screen.getByText(/magic tile, fuels spells/)).toBeInTheDocument();
  });

  it("renders one swatch per caste (Black/Red/White/Green/Blue)", () => {
    render(<HowToPlayDrawer open={true} onClose={() => undefined} />);
    for (const c of ["Black", "Red", "White", "Green", "Blue"]) {
      expect(screen.getByText(c)).toBeInTheDocument();
    }
  });

  it("renders the marker legend (Banner / Skull pennant / Glow)", () => {
    render(<HowToPlayDrawer open={true} onClose={() => undefined} />);
    expect(screen.getByText("Banner")).toBeInTheDocument();
    expect(screen.getByText("Skull pennant")).toBeInTheDocument();
    expect(screen.getByText("Glow")).toBeInTheDocument();
  });

  it("links to the full game rules at /game/help", () => {
    render(<HowToPlayDrawer open={true} onClose={() => undefined} />);
    const link = screen.getByRole("link", { name: /Full game rules/ });
    expect(link).toHaveAttribute("href", "/game/help");
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = jest.fn();
    render(<HowToPlayDrawer open={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close drawer"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = jest.fn();
    const { container } = render(
      <HowToPlayDrawer open={true} onClose={onClose} />
    );
    // The backdrop is the first child div with aria-hidden — query
    // structurally rather than relying on a role/label.
    const backdrop = container.querySelector('div[aria-hidden]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hides the drawer from assistive tech when closed", () => {
    const { container } = render(
      <HowToPlayDrawer open={false} onClose={() => undefined} />
    );
    const aside = container.querySelector("aside");
    expect(aside).toHaveAttribute("aria-hidden", "true");
  });

  it("exposes the drawer to assistive tech when open", () => {
    const { container } = render(
      <HowToPlayDrawer open={true} onClose={() => undefined} />
    );
    const aside = container.querySelector("aside");
    expect(aside).toHaveAttribute("aria-hidden", "false");
  });
});
