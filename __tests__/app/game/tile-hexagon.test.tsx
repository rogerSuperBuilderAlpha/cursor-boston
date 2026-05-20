/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/tiles/_components/TileHexagon.tsx`
 * (0% / 38 uncovered branches). Covers every conditional render branch:
 * own vs foreign tile, foreign with type-dot (military/food/magic),
 * unit-count display, armed-spell dot, shield emoji, hero glyph
 * (military/farm/magic), unowned no-pointer cursor, hover + click
 * callbacks, dimmed opacity on unmatched.
 */

import "@/__tests__/app/_shared/page-test-setup";

import React from "react";
import { fireEvent, render } from "@testing-library/react";

import { TileHexagon } from "@/app/game/tiles/_components/TileHexagon";

function makeTile(over: Partial<Record<string, unknown>> = {}) {
  return {
    tileId: "q1-r1",
    q: 1,
    r: 1,
    type: "forest",
    ownerId: null,
    units: { ground: 0, siege: 0, air: 0 },
    baseUnits: { ground: 0, siege: 0, air: 0 },
    armedDefenseSpellId: null,
    hero: null,
    ...over,
  } as never;
}

function renderHex(
  tile: ReturnType<typeof makeTile>,
  overProps: Partial<Record<string, unknown>> = {}
) {
  const onHoverEnter = jest.fn();
  const onHoverLeave = jest.fn();
  const onClick = jest.fn();
  const props = {
    tile,
    isOwn: false,
    matched: true,
    owner: null,
    onHoverEnter,
    onHoverLeave,
    onClick,
    ...overProps,
  } as never;
  const { container } = render(
    <svg>
      <TileHexagon {...props} />
    </svg>
  );
  return { container, onHoverEnter, onHoverLeave, onClick };
}

describe("TileHexagon", () => {
  it("renders an unowned tile with default cursor", () => {
    const { container } = renderHex(makeTile());
    const g = container.querySelector("g");
    expect(g?.getAttribute("style")).toMatch(/cursor:\s*default/);
  });

  it("renders an owned tile with pointer cursor and tileId label", () => {
    const { container } = renderHex(makeTile({ ownerId: "u1" }), { isOwn: true });
    const g = container.querySelector("g");
    expect(g?.getAttribute("style")).toMatch(/cursor:\s*pointer/);
    expect(container.textContent).toContain("q1-r1");
  });

  it("renders a foreign (other-owned) tile with foreign fill and caste border", () => {
    const { container } = renderHex(
      makeTile({ ownerId: "other", type: "military" }),
      { owner: { caste: "red", shielded: false } }
    );
    const poly = container.querySelector("polygon")!;
    expect(poly.getAttribute("stroke-width")).toBe("3.5");
    // Foreign type-dot circle should be present
    expect(container.querySelectorAll("circle").length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT render the inner type-dot when foreign tile is type=forest", () => {
    const { container } = renderHex(
      makeTile({ ownerId: "other", type: "forest" }),
      { owner: { caste: "red" } }
    );
    expect(container.querySelectorAll("circle").length).toBe(0);
  });

  it("renders unit count when total units > 0", () => {
    const { container } = renderHex(
      makeTile({
        units: { ground: 3, siege: 2, air: 1 },
        baseUnits: { ground: 4, siege: 0, air: 0 },
      })
    );
    expect(container.textContent).toContain("10");
  });

  it("counts base units even when no recruited units", () => {
    const { container } = renderHex(
      makeTile({ baseUnits: { ground: 5, siege: 0, air: 0 } })
    );
    expect(container.textContent).toContain("5");
  });

  it("does NOT render unit count when total is 0", () => {
    const { container } = renderHex(makeTile());
    expect(container.querySelector("text")).toBeNull();
  });

  it("renders armed-spell dot when armedDefenseSpellId is set", () => {
    const { container } = renderHex(
      makeTile({ armedDefenseSpellId: "spell-1" })
    );
    const armedCircle = Array.from(container.querySelectorAll("circle")).find(
      (c) => c.getAttribute("fill") === "#60a5fa"
    );
    expect(armedCircle).toBeTruthy();
  });

  it("renders shield emoji on foreign tile when owner.shielded=true", () => {
    const { container } = renderHex(
      makeTile({ ownerId: "other" }),
      { owner: { caste: "blue", shielded: true } }
    );
    expect(container.textContent).toContain("🛡");
  });

  it("does NOT render shield emoji on own tile even if owner.shielded=true", () => {
    const { container } = renderHex(
      makeTile({ ownerId: "u1" }),
      { isOwn: true, owner: { shielded: true } }
    );
    expect(container.textContent).not.toContain("🛡");
  });

  it("renders military hero glyph (⚔) when hero.class='military'", () => {
    const { container } = renderHex(
      makeTile({ hero: { class: "military", stamina: 100 } })
    );
    expect(container.textContent).toContain("⚔");
  });

  it("renders farm hero glyph (⚘) when hero.class='farm'", () => {
    const { container } = renderHex(
      makeTile({ hero: { class: "farm", stamina: 100 } })
    );
    expect(container.textContent).toContain("⚘");
  });

  it("renders magic hero glyph (✦) for any other hero.class", () => {
    const { container } = renderHex(
      makeTile({ hero: { class: "magic", stamina: 100 } })
    );
    expect(container.textContent).toContain("✦");
  });

  it("does NOT render hero glyph when hero is null", () => {
    const { container } = renderHex(makeTile());
    expect(container.textContent).not.toContain("⚔");
    expect(container.textContent).not.toContain("⚘");
    expect(container.textContent).not.toContain("✦");
  });

  it("renders dim opacity when matched=false", () => {
    const { container } = renderHex(makeTile(), { matched: false });
    const g = container.querySelector("g");
    expect(g?.getAttribute("opacity")).toBe("0.12");
  });

  it("renders full opacity when matched=true", () => {
    const { container } = renderHex(makeTile());
    const g = container.querySelector("g");
    expect(g?.getAttribute("opacity")).toBe("1");
  });

  it("invokes onHoverEnter / onHoverLeave / onClick with the tile", () => {
    const tile = makeTile({ ownerId: "u1" });
    const { container, onHoverEnter, onHoverLeave, onClick } = renderHex(tile, {
      isOwn: true,
    });
    const g = container.querySelector("g")!;
    fireEvent.mouseEnter(g);
    expect(onHoverEnter).toHaveBeenCalledWith(tile);
    fireEvent.mouseLeave(g);
    expect(onHoverLeave).toHaveBeenCalledWith(tile);
    fireEvent.click(g);
    expect(onClick).toHaveBeenCalledWith(tile);
  });

  it("uses caste-color border for foreign tile without owner.caste falls back to neutral", () => {
    const { container } = renderHex(
      makeTile({ ownerId: "other" }),
      { owner: null }
    );
    const poly = container.querySelector("polygon")!;
    expect(poly.getAttribute("stroke")).toBe("#737373");
  });
});
