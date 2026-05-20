/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/threats/_components/ManageSourcePanel.tsx`
 * (0% / 51 uncovered branches). Covers source summary line, land-type
 * assign buttons (current/cant-spend/can-spend), recruit-units button
 * gating (need-land-type/need-turns/ok), defense spell render branches
 * (already-armed/need-turns/need-tiles/ok), defensive artifacts section
 * (rendered or hidden when empty), Section component meta + description
 * conditional rendering.
 */

import "@/__tests__/app/_shared/page-test-setup";

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("@/app/game/_components/CatalogImage", () => ({
  CatalogImage: ({ entry }: { entry: { name?: string } }) => (
    <span data-testid="catalog-image">{entry?.name ?? "img"}</span>
  ),
}));

jest.mock("@/app/game/recruit/_lib/constants", () => ({
  unitsPerCycleForLand: (type: string) =>
    type === "military" ? 5 : type === "food" || type === "magic" ? 3 : 0,
}));

import { ManageSourcePanel } from "@/app/game/threats/_components/ManageSourcePanel";

function makeTile(over: Partial<Record<string, unknown>> = {}) {
  return {
    tileId: "q1-r1",
    type: "military",
    units: { ground: 2, siege: 1, air: 0 },
    baseUnits: { ground: 5, siege: 0, air: 0 },
    armedDefenseSpellId: null,
    ...over,
  } as never;
}

function makePlayer(over: Partial<Record<string, unknown>> = {}) {
  return {
    turnsRemaining: 100,
    stats: { tilesHeld: 50 },
    ...over,
  } as never;
}

function renderPanel(over: Partial<Record<string, unknown>> = {}) {
  const onAssign = jest.fn();
  const onRecruit = jest.fn();
  const onArmDefenseSpell = jest.fn();
  const onUseDefensiveArtifact = jest.fn();
  const props = {
    source: makeTile(),
    player: makePlayer(),
    busy: false,
    defenseSpells: [],
    defensiveArtifacts: [],
    onAssign,
    onRecruit,
    onArmDefenseSpell,
    onUseDefensiveArtifact,
    ...over,
  } as never;
  render(<ManageSourcePanel {...props} />);
  return { onAssign, onRecruit, onArmDefenseSpell, onUseDefensiveArtifact };
}

describe("ManageSourcePanel — summary + assign", () => {
  it("renders the source summary line with totals", () => {
    renderPanel();
    expect(screen.getByText("q1-r1")).toBeInTheDocument();
    expect(screen.getAllByText(/military/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/G7 S1 A0/)).toBeInTheDocument();
  });

  it("disables Military assign when current type is military (Already military)", () => {
    renderPanel();
    const btn = screen.getByRole("button", { name: /^Military$/ });
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("title")).toMatch(/Already military/);
  });

  it("calls onAssign for non-current assignable types", () => {
    const { onAssign } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /^Food$/ }));
    expect(onAssign).toHaveBeenCalledWith("food");
  });

  it("disables all non-current assigns when player has 0 turns", () => {
    renderPanel({ player: makePlayer({ turnsRemaining: 0 }) });
    const btn = screen.getByRole("button", { name: /^Food$/ });
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("title")).toMatch(/Need 1 turn/);
  });

  it("disables all assigns when busy=true", () => {
    renderPanel({ busy: true });
    expect(screen.getByRole("button", { name: /^Food$/ })).toBeDisabled();
  });
});

describe("ManageSourcePanel — recruit", () => {
  it("invokes onRecruit when a unit button is clicked on a land-typed tile", () => {
    const { onRecruit } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /\+5 ground/ }));
    expect(onRecruit).toHaveBeenCalledWith("ground");
  });

  it("disables recruit when source.type=unassigned (yieldPerCycle 0 → 'Assign a land type first')", () => {
    renderPanel({ source: makeTile({ type: "unassigned" }) });
    const btn = screen.getByRole("button", { name: /\+10 ground/ });
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("title")).toMatch(/Assign a land type first/);
  });

  it("disables recruit when player.turnsRemaining < 5", () => {
    renderPanel({ player: makePlayer({ turnsRemaining: 3 }) });
    const btn = screen.getByRole("button", { name: /\+5 ground/ });
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("title")).toMatch(/Need 5 turns/);
  });

  it("Recruit description shifts when yieldPerCycle is 0 (unassigned land)", () => {
    renderPanel({ source: makeTile({ type: "unassigned" }) });
    expect(screen.getByText(/cannot recruit until you assign/)).toBeInTheDocument();
  });
});

describe("ManageSourcePanel — defense spells", () => {
  const spell = {
    id: "frost-wall",
    name: "Frost Wall",
    tier: 2,
    minTilesRequired: 10,
    description: "Freezes invaders.",
  } as never;

  it("does NOT render the spell section when defenseSpells is empty", () => {
    renderPanel();
    expect(screen.queryByText(/Arm a defense spell/)).not.toBeInTheDocument();
  });

  it("renders spell button + invokes onArmDefenseSpell when clicked", () => {
    const { onArmDefenseSpell } = renderPanel({ defenseSpells: [spell] });
    expect(screen.getByText(/Arm a defense spell/)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /Frost Wall/ });
    fireEvent.click(btn);
    expect(onArmDefenseSpell).toHaveBeenCalledWith("frost-wall");
  });

  it("disables spell button with 'Already armed' when source.armedDefenseSpellId matches", () => {
    renderPanel({
      defenseSpells: [spell],
      source: makeTile({ armedDefenseSpellId: "frost-wall" }),
    });
    const btn = screen.getByRole("button", { name: /Frost Wall/ });
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("title")).toMatch(/Already armed/);
  });

  it("disables spell with 'Need 5 turns' when player.turnsRemaining < 5", () => {
    renderPanel({
      defenseSpells: [spell],
      player: makePlayer({ turnsRemaining: 1 }),
    });
    const btn = screen.getByRole("button", { name: /Frost Wall/ });
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("title")).toMatch(/Need 5 turns/);
  });

  it("disables spell with 'Need N tiles' when player.stats.tilesHeld is below threshold", () => {
    renderPanel({
      defenseSpells: [spell],
      player: makePlayer({ stats: { tilesHeld: 1 } }),
    });
    const btn = screen.getByRole("button", { name: /Frost Wall/ });
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("title")).toMatch(/Need 10 tiles/);
  });
});

describe("ManageSourcePanel — defensive artifacts", () => {
  it("does NOT render the artifacts section when empty", () => {
    renderPanel();
    expect(screen.queryByText(/Defense artifacts/)).not.toBeInTheDocument();
  });

  it("renders artifact button using definition.name and invokes onUseDefensiveArtifact", () => {
    const { onUseDefensiveArtifact } = renderPanel({
      defensiveArtifacts: [
        {
          artifact: { id: "a1", definitionId: "shield" },
          definition: { name: "Aegis", description: "Blocks first attack." },
        },
      ],
    });
    expect(screen.getByText(/Defense artifacts/)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /Aegis/ });
    fireEvent.click(btn);
    expect(onUseDefensiveArtifact).toHaveBeenCalledWith("a1");
  });

  it("falls back to artifact.definitionId when definition is null", () => {
    renderPanel({
      defensiveArtifacts: [
        { artifact: { id: "a1", definitionId: "shield" }, definition: null },
      ],
    });
    expect(screen.getAllByText("shield").length).toBeGreaterThan(0);
  });

  it("artifact button is disabled when busy=true", () => {
    renderPanel({
      busy: true,
      defensiveArtifacts: [
        { artifact: { id: "a1", definitionId: "shield" }, definition: { name: "Aegis" } },
      ],
    });
    expect(screen.getByRole("button", { name: /Aegis/ })).toBeDisabled();
  });
});
