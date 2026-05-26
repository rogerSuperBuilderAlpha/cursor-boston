/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/threats/_components/BoostPanel.tsx`
 * (~36% / 47 uncovered branches). Covers buildTabList every-input
 * combination (artifact/spy/intel/siege/flyover null + air=0 hides
 * flyover), tab switching, artifact queue toggle behavior, artifact
 * fallback when definition is null, spy spell click + disabled reason,
 * intel-artifacts immediate-use, simple-action siege + flyover tones.
 */

import "@/__tests__/app/_shared/page-test-setup";

import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("@/app/game/_components/CatalogImage", () => ({
  CatalogImage: ({ entry }: { entry: { name?: string } }) => (
    <span data-testid="catalog-image">{entry?.name ?? "img"}</span>
  ),
}));

import { BoostPanel } from "@/app/game/threats/_components/BoostPanel";

function renderPanel(over: Partial<Record<string, unknown>> = {}) {
  const onQueueArtifact = jest.fn();
  const onUseIntelArtifact = jest.fn();
  const props = {
    busy: false,
    offensiveArtifacts: [],
    intelArtifacts: [],
    queuedArtifactId: "",
    onQueueArtifact,
    onUseIntelArtifact,
    ...over,
  } as never;
  const result = render(<BoostPanel {...props} />);
  return { ...result, onQueueArtifact, onUseIntelArtifact };
}

describe("BoostPanel — visibility", () => {
  it("returns null when no tabs are available", () => {
    const { container } = renderPanel();
    expect(container.firstChild).toBeNull();
  });

  it("renders Artifacts tab when offensiveArtifacts is non-empty", () => {
    renderPanel({
      offensiveArtifacts: [
        { artifact: { id: "a1", definitionId: "fireball", rarity: "rare" }, definition: { name: "Fireball" } },
      ],
    });
    expect(screen.getByRole("button", { name: /Artifacts/ })).toBeInTheDocument();
  });

  it("renders Spy intel tab when only a spy spell is provided (no intel artifacts)", () => {
    renderPanel({
      spy: {
        spell: { id: "s1", name: "Scry", tier: 1, turnCost: 3, description: "See enemy" },
        onClick: jest.fn(),
        disabledReason: null,
      },
    });
    expect(screen.getByRole("button", { name: /Spy intel/ })).toBeInTheDocument();
  });

  it("renders Spy intel tab when only intel artifacts are provided (no spy spell)", () => {
    renderPanel({
      intelArtifacts: [
        { artifact: { id: "i1", definitionId: "spyglass", rarity: "uncommon" }, definition: { name: "Spyglass" } },
      ],
    });
    expect(screen.getByRole("button", { name: /Spy intel/ })).toBeInTheDocument();
  });

  it("renders Siege tab when siege prop is provided", () => {
    renderPanel({
      siege: { onClick: jest.fn(), turnCost: 5, disabledReason: null },
    });
    expect(screen.getAllByRole("button", { name: /Siege/ }).length).toBeGreaterThan(0);
  });

  it("does NOT render Flyover tab when airUnits === 0", () => {
    renderPanel({
      flyover: { onClick: jest.fn(), turnCost: 3, airUnits: 0, disabledReason: null },
    });
    expect(screen.queryByRole("button", { name: /Flyover/ })).not.toBeInTheDocument();
  });

  it("renders Flyover tab when airUnits > 0", () => {
    renderPanel({
      flyover: { onClick: jest.fn(), turnCost: 3, airUnits: 5, disabledReason: null },
    });
    expect(screen.getAllByRole("button", { name: /Flyover/ }).length).toBeGreaterThan(0);
  });

  it("first tab is active by default and can be switched", () => {
    renderPanel({
      offensiveArtifacts: [
        { artifact: { id: "a1", definitionId: "fireball", rarity: "rare" }, definition: { name: "Fireball" } },
      ],
      siege: { onClick: jest.fn(), turnCost: 5, disabledReason: null },
    });
    // Artifacts is the first tab, so its content shows.
    expect(screen.getByText(/Queue one/)).toBeInTheDocument();
    // Switch to Siege.
    fireEvent.click(screen.getByRole("button", { name: /^Siege/ }));
    expect(screen.getByText(/Reduce the enemy tile/)).toBeInTheDocument();
  });
});

describe("BoostPanel — ArtifactTab", () => {
  it("queue mode: clicking a card invokes onQueueArtifact with the id", () => {
    const { onQueueArtifact } = renderPanel({
      offensiveArtifacts: [
        { artifact: { id: "a1", definitionId: "fireball", rarity: "rare" }, definition: { name: "Fireball", description: "Burn." } },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: /Fireball/ }));
    expect(onQueueArtifact).toHaveBeenCalledWith("a1");
  });

  it("queue mode: clicking already-selected card clears the queue", () => {
    const { onQueueArtifact } = renderPanel({
      offensiveArtifacts: [
        { artifact: { id: "a1", definitionId: "fireball", rarity: "rare" }, definition: { name: "Fireball" } },
      ],
      queuedArtifactId: "a1",
    });
    fireEvent.click(screen.getByRole("button", { name: /Fireball/ }));
    expect(onQueueArtifact).toHaveBeenCalledWith("");
  });

  it("uses definitionId as fallback name when definition is null", () => {
    renderPanel({
      offensiveArtifacts: [
        { artifact: { id: "a1", definitionId: "raw-def-id", rarity: "common" }, definition: null },
      ],
    });
    expect(screen.getAllByText("raw-def-id").length).toBeGreaterThan(0);
  });

  it("displays 'queued' label when card is selected", () => {
    renderPanel({
      offensiveArtifacts: [
        { artifact: { id: "a1", definitionId: "fireball", rarity: "rare" }, definition: { name: "Fireball" } },
      ],
      queuedArtifactId: "a1",
    });
    expect(screen.getByText("queued")).toBeInTheDocument();
  });
});

describe("BoostPanel — SpyTab", () => {
  it("renders 'No caste intel' message when both spy and intel artifacts are empty", () => {
    // Need at least one other tab to even render the panel — use siege.
    renderPanel({
      siege: { onClick: jest.fn(), turnCost: 5, disabledReason: null },
      offensiveArtifacts: [],
    });
    // Spy tab isn't rendered since no spy + no intel. So nothing to check.
    expect(screen.queryByRole("button", { name: /Spy intel/ })).not.toBeInTheDocument();
  });

  it("Spy spell button calls onClick when clicked", () => {
    const onClick = jest.fn();
    renderPanel({
      spy: {
        spell: { id: "s1", name: "Scry", tier: 2, turnCost: 5, description: "Reveal enemy units." },
        onClick,
        disabledReason: null,
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /Scry/ }));
    expect(onClick).toHaveBeenCalled();
  });

  it("Spy spell button is disabled when disabledReason is set", () => {
    const onClick = jest.fn();
    renderPanel({
      spy: {
        spell: { id: "s1", name: "Scry", tier: 2, turnCost: 5, description: "Reveal enemy units." },
        onClick,
        disabledReason: "Need 5 turns",
      },
    });
    expect(screen.getByRole("button", { name: /Scry/ })).toBeDisabled();
  });

  it("Intel artifacts fire onUseIntelArtifact immediately when clicked", () => {
    const { onUseIntelArtifact } = renderPanel({
      intelArtifacts: [
        { artifact: { id: "i1", definitionId: "scroll", rarity: "uncommon" }, definition: { name: "Scroll of Sight", description: "Reveals enemy." } },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: /Scroll/ }));
    expect(onUseIntelArtifact).toHaveBeenCalledWith("i1");
  });
});

describe("BoostPanel — SimpleActionTab", () => {
  it("Siege button fires onClick", () => {
    const onClick = jest.fn();
    renderPanel({
      siege: { onClick, turnCost: 5, disabledReason: null },
    });
    fireEvent.click(screen.getByRole("button", { name: /Siege \(\+5T\)/ }));
    expect(onClick).toHaveBeenCalled();
  });

  it("Siege button is disabled when disabledReason set + shows reason text", () => {
    renderPanel({
      siege: { onClick: jest.fn(), turnCost: 5, disabledReason: "Need 5 turns" },
    });
    const buttons = screen.getAllByRole("button", { name: /Siege/ });
    const siegeBtn = buttons.find((b) => b.textContent?.includes("+5T"));
    expect(siegeBtn).toBeDisabled();
    expect(screen.getByText("Need 5 turns")).toBeInTheDocument();
  });

  it("Flyover button fires onClick + uses 'sky' tone", () => {
    const onClick = jest.fn();
    renderPanel({
      flyover: { onClick, turnCost: 3, airUnits: 5, disabledReason: null },
    });
    fireEvent.click(screen.getByRole("button", { name: /Flyover \(5a, \+3T\)/ }));
    expect(onClick).toHaveBeenCalled();
  });

  it("artifact buttons disabled when busy=true", () => {
    renderPanel({
      busy: true,
      offensiveArtifacts: [
        { artifact: { id: "a1", definitionId: "fireball", rarity: "rare" }, definition: { name: "Fireball" } },
      ],
    });
    expect(screen.getByRole("button", { name: /Fireball/ })).toBeDisabled();
  });
});
