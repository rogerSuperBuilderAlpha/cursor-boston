/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/tiles/_components/TileHoverCard.tsx`
 * (0% / 19 uncovered branches). Covers tileId/type display, unit count
 * totaling, garrison line shown when baseUnits sum > 0, armed-spell
 * line, foreign-tile owner block (displayName fallback + caste fallback
 * + shielded vs targetable), own-tile vs foreign action hint copy.
 */

import "@/__tests__/app/_shared/page-test-setup";

import { render, screen } from "@testing-library/react";

import { TileHoverCard } from "@/app/game/tiles/_components/TileHoverCard";

function makeTile(over: Partial<Record<string, unknown>> = {}) {
  return {
    tileId: "q1-r1",
    q: 1,
    r: 1,
    type: "military",
    ownerId: null,
    units: { ground: 0, siege: 0, air: 0 },
    baseUnits: { ground: 0, siege: 0, air: 0 },
    armedDefenseSpellId: null,
    ...over,
  } as never;
}

describe("TileHoverCard", () => {
  it("renders tileId + type + unit summary", () => {
    render(
      <TileHoverCard
        hovered={makeTile({ units: { ground: 3, siege: 1, air: 2 } })}
        hoveredOwner={null}
        isOwnTile={false}
      />
    );
    expect(screen.getByText("q1-r1")).toBeInTheDocument();
    expect(screen.getByText("military")).toBeInTheDocument();
    expect(screen.getByText(/G 3 · S 1 · A 2/)).toBeInTheDocument();
  });

  it("totals base + recruited units in the summary line", () => {
    render(
      <TileHoverCard
        hovered={makeTile({
          units: { ground: 1, siege: 1, air: 1 },
          baseUnits: { ground: 4, siege: 2, air: 0 },
        })}
        hoveredOwner={null}
        isOwnTile={false}
      />
    );
    expect(screen.getByText(/G 5 · S 3 · A 1/)).toBeInTheDocument();
  });

  it("renders garrison line when baseUnits sum > 0", () => {
    render(
      <TileHoverCard
        hovered={makeTile({ baseUnits: { ground: 5, siege: 0, air: 0 } })}
        hoveredOwner={null}
        isOwnTile={false}
      />
    );
    expect(screen.getByText(/garrison: 5G\/0S\/0A/)).toBeInTheDocument();
  });

  it("does NOT render garrison line when baseUnits sum is 0", () => {
    const { container } = render(
      <TileHoverCard
        hovered={makeTile()}
        hoveredOwner={null}
        isOwnTile={false}
      />
    );
    expect(container.textContent).not.toMatch(/garrison/);
  });

  it("renders armed-spell line when armedDefenseSpellId is set", () => {
    render(
      <TileHoverCard
        hovered={makeTile({ armedDefenseSpellId: "blizzard" })}
        hoveredOwner={null}
        isOwnTile={false}
      />
    );
    expect(screen.getByText(/Armed: blizzard/)).toBeInTheDocument();
  });

  it("does NOT render owner block when tile is unowned", () => {
    const { container } = render(
      <TileHoverCard
        hovered={makeTile()}
        hoveredOwner={null}
        isOwnTile={false}
      />
    );
    expect(container.textContent).not.toMatch(/click to/);
    expect(container.textContent).not.toMatch(/no caste/);
  });

  it("renders owner block with displayName + caste on foreign tile", () => {
    render(
      <TileHoverCard
        hovered={makeTile({ ownerId: "u2" })}
        hoveredOwner={{ displayName: "Alice", caste: "red", shielded: false } as never}
        isOwnTile={false}
      />
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("red")).toBeInTheDocument();
    expect(screen.getByText(/Targetable/)).toBeInTheDocument();
  });

  it("falls back to 'Unnamed general' when displayName is missing", () => {
    render(
      <TileHoverCard
        hovered={makeTile({ ownerId: "u2" })}
        hoveredOwner={{ caste: "blue", shielded: false } as never}
        isOwnTile={false}
      />
    );
    expect(screen.getByText("Unnamed general")).toBeInTheDocument();
  });

  it("falls back to 'no caste' when caste is missing", () => {
    render(
      <TileHoverCard
        hovered={makeTile({ ownerId: "u2" })}
        hoveredOwner={{ displayName: "Bob" } as never}
        isOwnTile={false}
      />
    );
    expect(screen.getByText("no caste")).toBeInTheDocument();
  });

  it("renders shielded message when hoveredOwner.shielded=true", () => {
    render(
      <TileHoverCard
        hovered={makeTile({ ownerId: "u2" })}
        hoveredOwner={{ displayName: "Bob", caste: "red", shielded: true } as never}
        isOwnTile={false}
      />
    );
    expect(screen.getByText(/Shielded/)).toBeInTheDocument();
  });

  it("renders 'click to attack' hint for foreign owned tile", () => {
    render(
      <TileHoverCard
        hovered={makeTile({ ownerId: "u2" })}
        hoveredOwner={{ displayName: "Bob", caste: "red", shielded: false } as never}
        isOwnTile={false}
      />
    );
    expect(screen.getByText(/click to attack/)).toBeInTheDocument();
  });

  it("renders 'click to manage' hint for own owned tile (no owner block)", () => {
    const { container } = render(
      <TileHoverCard
        hovered={makeTile({ ownerId: "u1" })}
        hoveredOwner={null}
        isOwnTile={true}
      />
    );
    expect(screen.getByText(/click to manage/)).toBeInTheDocument();
    // Own tile must not render the foreign owner block
    expect(container.textContent).not.toMatch(/Targetable/);
  });

  it("works when baseUnits is undefined (falls back to recruited only)", () => {
    render(
      <TileHoverCard
        hovered={{
          tileId: "x",
          q: 0,
          r: 0,
          type: "forest",
          ownerId: null,
          units: { ground: 2, siege: 0, air: 0 },
        } as never}
        hoveredOwner={null}
        isOwnTile={false}
      />
    );
    expect(screen.getByText(/G 2 · S 0 · A 0/)).toBeInTheDocument();
  });
});
