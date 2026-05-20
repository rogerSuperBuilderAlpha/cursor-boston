/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/_components/dashboard/HeroesRosterCard.tsx`
 * was at 12.5% branches (14 uncovered). Covers the null-when-empty guard,
 * the heroes derivation from tiles (with/without hero), class glyph + color
 * branches (military / farm / magic), stamina-bar color thresholds (<30 /
 * <60 / ≥60), and clamping (negative / over-max stamina).
 */

import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import { HeroesRosterCard } from "@/app/game/_components/dashboard/HeroesRosterCard";

type Hero = {
  id: string;
  name: string;
  class: "military" | "farm" | "magic";
  specialty: string;
  tileId: string;
  stamina: number;
  staminaMax: number;
};

type Tile = {
  hero?: Hero;
};

function tileWithHero(over: Partial<Hero> = {}): Tile {
  return {
    hero: {
      id: "h-" + (over.name || "x"),
      name: over.name ?? "Hero",
      class: over.class ?? "military",
      specialty: over.specialty ?? "frontline",
      tileId: over.tileId ?? "1_0",
      stamina: over.stamina ?? 80,
      staminaMax: over.staminaMax ?? 100,
    },
  };
}

describe("HeroesRosterCard", () => {
  it("renders nothing when tiles has no heroes", () => {
    const { container } = render(
      <HeroesRosterCard tiles={[{}, {}, {}] as never} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when tiles is empty", () => {
    const { container } = render(<HeroesRosterCard tiles={[] as never} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the Heroes section with class-count summary", () => {
    render(
      <HeroesRosterCard
        tiles={
          [
            tileWithHero({ name: "Ada", class: "military" }),
            tileWithHero({ name: "Bea", class: "farm", tileId: "2_0" }),
            tileWithHero({ name: "Cal", class: "magic", tileId: "3_0" }),
            tileWithHero({ name: "Dee", class: "military", tileId: "4_0" }),
          ] as never
        }
      />
    );
    expect(screen.getByText("Heroes")).toBeInTheDocument();
    // counts: 2 military, 1 farm, 1 magic
    expect(screen.getByText(/⚔ 2 · ⚘ 1 · ✦ 1/)).toBeInTheDocument();
  });

  it("renders the military class glyph + name + specialty (kebab → space)", () => {
    render(
      <HeroesRosterCard
        tiles={
          [
            tileWithHero({
              name: "Ada",
              class: "military",
              specialty: "siege-master",
            }),
          ] as never
        }
      />
    );
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("siege master")).toBeInTheDocument();
    // Glyph for military is the crossed-swords ⚔ character.
    expect(screen.getAllByText("⚔").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the farm class glyph (⚘) and the amber color class", () => {
    const { container } = render(
      <HeroesRosterCard
        tiles={[tileWithHero({ name: "Bea", class: "farm" })] as never}
      />
    );
    expect(screen.getAllByText("⚘").length).toBeGreaterThanOrEqual(1);
    expect(container.querySelector(".text-amber-600")).not.toBeNull();
  });

  it("renders the magic class glyph (✦) and the violet color class", () => {
    const { container } = render(
      <HeroesRosterCard
        tiles={[tileWithHero({ name: "Cal", class: "magic" })] as never}
      />
    );
    expect(screen.getAllByText("✦").length).toBeGreaterThanOrEqual(1);
    expect(container.querySelector(".text-violet-600")).not.toBeNull();
  });

  it("applies red bar color when stamina percentage < 30", () => {
    const { container } = render(
      <HeroesRosterCard
        tiles={
          [
            tileWithHero({
              name: "Tired",
              stamina: 10,
              staminaMax: 100,
            }),
          ] as never
        }
      />
    );
    expect(container.querySelector(".bg-red-500")).not.toBeNull();
    expect(container.querySelector(".bg-amber-500")).toBeNull();
    expect(container.querySelector(".bg-emerald-500")).toBeNull();
  });

  it("applies amber bar color when 30 ≤ stamina% < 60", () => {
    const { container } = render(
      <HeroesRosterCard
        tiles={
          [
            tileWithHero({
              name: "Mid",
              stamina: 45,
              staminaMax: 100,
            }),
          ] as never
        }
      />
    );
    expect(container.querySelector(".bg-amber-500")).not.toBeNull();
    expect(container.querySelector(".bg-red-500")).toBeNull();
    expect(container.querySelector(".bg-emerald-500")).toBeNull();
  });

  it("applies emerald bar color when stamina% ≥ 60", () => {
    const { container } = render(
      <HeroesRosterCard
        tiles={
          [
            tileWithHero({
              name: "Healthy",
              stamina: 95,
              staminaMax: 100,
            }),
          ] as never
        }
      />
    );
    expect(container.querySelector(".bg-emerald-500")).not.toBeNull();
  });

  it("clamps negative stamina to 0% (lower-bound)", () => {
    const { container } = render(
      <HeroesRosterCard
        tiles={
          [
            tileWithHero({
              name: "Underflow",
              stamina: -20,
              staminaMax: 100,
            }),
          ] as never
        }
      />
    );
    const bar = container.querySelector('div[style*="width: 0%"]');
    expect(bar).not.toBeNull();
  });

  it("clamps stamina above max to 100% (upper-bound)", () => {
    const { container } = render(
      <HeroesRosterCard
        tiles={
          [
            tileWithHero({
              name: "Overflow",
              stamina: 200,
              staminaMax: 100,
            }),
          ] as never
        }
      />
    );
    const bar = container.querySelector('div[style*="width: 100%"]');
    expect(bar).not.toBeNull();
  });

  it("renders a hero detail link with URL-encoded id", () => {
    render(
      <HeroesRosterCard
        tiles={[tileWithHero({ name: "X", tileId: "1_2 with space" })] as never}
      />
    );
    const tileLink = screen
      .getAllByText(/1_2 with space/)[0]
      .closest("a");
    expect(tileLink?.getAttribute("href")).toContain(
      encodeURIComponent("1_2 with space")
    );
  });

  it("displays the stamina ratio in the right-aligned counter", () => {
    render(
      <HeroesRosterCard
        tiles={
          [tileWithHero({ name: "X", stamina: 47, staminaMax: 100 })] as never
        }
      />
    );
    expect(screen.getByText("47/100")).toBeInTheDocument();
  });

  it("filters out tiles without a hero when computing the roster", () => {
    render(
      <HeroesRosterCard
        tiles={
          [
            {},
            tileWithHero({ name: "Solo", class: "magic" }),
            {},
          ] as never
        }
      />
    );
    // Only one row, all glyphs are visible exactly once. (counts label + row glyph)
    expect(screen.getByText("Solo")).toBeInTheDocument();
    expect(screen.getByText(/⚔ 0 · ⚘ 0 · ✦ 1/)).toBeInTheDocument();
  });
});
