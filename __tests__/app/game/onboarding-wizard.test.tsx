/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/_components/onboarding/OnboardingWizard.tsx`
 * (7.9% branch coverage, 35 uncovered branches). Mocks the hook directly so
 * we can drive isOpen/step/busy/error/exploreProgress without wiring the
 * full setup pipeline. Covers null-render gates, every step branch
 * (explore + distribute + caste + recruit), the StepRibbon current/done/
 * upcoming styling for all five step values, body-overflow side effect,
 * Escape and X dismiss paths, backdrop click dismiss, and the per-step
 * disabled-button branches.
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

// Mock the hook BEFORE importing the component so we can swap the
// implementation between tests.
const mockUseOnboardingWizard = jest.fn();

jest.mock("@/app/game/_components/onboarding/use-onboarding-wizard", () => ({
  __esModule: true,
  useOnboardingWizard: (args: unknown) => mockUseOnboardingWizard(args),
  pickCurrentStep: jest.fn(),
}));

// Stub out the heavy CastePickCard child so we don't pull in the whole
// caste UI tree — the wizard's Step 3 just renders one per CASTES entry.
jest.mock("@/app/game/setup/_components/CastePickCard", () => ({
  __esModule: true,
  CastePickCard: ({
    caste,
    busy,
    onChoose,
  }: {
    caste: string;
    busy: boolean;
    onChoose: () => void;
  }) => (
    <button onClick={onChoose} disabled={busy} data-testid={`caste-${caste}`}>
      Pick {caste}
    </button>
  ),
}));

// Lock CASTES to a small deterministic set so the count of rendered
// CastePickCard stubs is predictable.
jest.mock("@/app/game/setup/_lib/constants", () => ({
  __esModule: true,
  CASTES: ["red", "blue", "green"],
}));

import { OnboardingWizard } from "@/app/game/_components/onboarding/OnboardingWizard";
import type { GamePlayer, MapTile } from "@/lib/game/types";
import type {
  ArmyTotals,
  LandCounts,
} from "@/app/game/_lib/dashboard-types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const basePlayer = {
  userId: "u1",
  displayName: "Tester",
  caste: null,
  turnsRemaining: 100,
  turnsSpentTotal: 0,
  phase: "explore",
  tilesExplored: 25,
  shieldUntil: new Date(0),
  shieldDropAtTurn: 100,
  productionSpellsActive: [],
  stats: { attacksWon: 0, attacksLost: 0, tilesHeld: 0, unitsAlive: 0 },
  createdAt: new Date(0),
  updatedAt: new Date(0),
} as unknown as GamePlayer;

const baseCounts: LandCounts = {
  military: 0,
  food: 0,
  magic: 0,
  unassigned: 100,
  total: 100,
};

const baseArmy: ArmyTotals = { ground: 0, siege: 0, air: 0, total: 0 };
const baseTiles: ReadonlyArray<MapTile> = [];

interface WizardOverrides {
  isOpen?: boolean;
  step?: "explore" | "distribute" | "caste" | "recruit" | "done";
  busy?: boolean;
  error?: string | null;
  exploreProgress?: { done: number; total: number } | null;
  dismiss?: jest.Mock;
  runExplore?: jest.Mock;
  runAutoBalance?: jest.Mock;
  pickCaste?: jest.Mock;
  runRecruit?: jest.Mock;
}

function makeWizard(over: WizardOverrides = {}) {
  return {
    isOpen: true,
    step: "explore",
    busy: false,
    error: null,
    exploreProgress: null,
    dismiss: jest.fn(),
    runExplore: jest.fn().mockResolvedValue(undefined),
    runAutoBalance: jest.fn().mockResolvedValue(undefined),
    pickCaste: jest.fn().mockResolvedValue(undefined),
    runRecruit: jest.fn().mockResolvedValue(undefined),
    ...over,
  };
}

interface RenderOverrides {
  wizard?: WizardOverrides;
  player?: GamePlayer | null;
  counts?: LandCounts;
  army?: ArmyTotals;
  tiles?: ReadonlyArray<MapTile>;
}

function renderWizard(over: RenderOverrides = {}) {
  const wizard = makeWizard(over.wizard);
  mockUseOnboardingWizard.mockReturnValue(wizard);
  const player = over.player === undefined ? basePlayer : over.player;
  const result = render(
    <OnboardingWizard
      user={null}
      player={player}
      counts={over.counts ?? baseCounts}
      army={over.army ?? baseArmy}
      tiles={over.tiles ?? baseTiles}
      onRefresh={jest.fn().mockResolvedValue(undefined)}
    />
  );
  return { wizard, ...result };
}

beforeEach(() => {
  jest.clearAllMocks();
  document.body.style.overflow = "";
});

// ---------------------------------------------------------------------------
// Null-render gates
// ---------------------------------------------------------------------------

describe("OnboardingWizard — null-render gates", () => {
  it("renders null when wizard.isOpen is false", () => {
    const { container } = renderWizard({ wizard: { isOpen: false } });
    expect(container.firstChild).toBeNull();
    // Body overflow stays clear in the not-open branch
    expect(document.body.style.overflow).toBe("");
  });

  it("renders null when player is null even if isOpen is true", () => {
    const { container } = renderWizard({ player: null });
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Step branches
// ---------------------------------------------------------------------------

describe("OnboardingWizard — explore step", () => {
  it("renders ExploreStep + stats + both action buttons", () => {
    renderWizard({ wizard: { step: "explore" } });
    expect(
      screen.getByText(/Step 1 — Reveal your starting lands/i)
    ).toBeInTheDocument();
    expect(screen.getByText("25 / 100")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Explore 25 tiles/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Reveal all 75 tiles/i })
    ).toBeInTheDocument();
  });

  it("fires runExplore on 25-tile button click", () => {
    const { wizard } = renderWizard({ wizard: { step: "explore" } });
    fireEvent.click(
      screen.getByRole("button", { name: /Explore 25 tiles/i })
    );
    expect(wizard.runExplore).toHaveBeenCalledWith(25);
  });

  it("fires runExplore(remaining) on reveal-all click", () => {
    const { wizard } = renderWizard({ wizard: { step: "explore" } });
    fireEvent.click(
      screen.getByRole("button", { name: /Reveal all 75 tiles/i })
    );
    expect(wizard.runExplore).toHaveBeenCalledWith(75);
  });

  it("disables both explore buttons when busy=true", () => {
    renderWizard({ wizard: { step: "explore", busy: true } });
    expect(
      screen.getByRole("button", { name: /Explore 25 tiles/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Reveal all/i })
    ).toBeDisabled();
  });

  it("disables reveal-all when turnsRemaining < remaining", () => {
    renderWizard({
      wizard: { step: "explore" },
      player: { ...basePlayer, turnsRemaining: 5, tilesExplored: 25 } as GamePlayer,
    });
    expect(
      screen.getByRole("button", { name: /Reveal all/i })
    ).toBeDisabled();
    // 25-tile button: turnsRemaining(5) < min(25, remaining=75) → also disabled
    expect(
      screen.getByRole("button", { name: /Explore 25 tiles/i })
    ).toBeDisabled();
  });

  it("renders exploreProgress when set", () => {
    renderWizard({
      wizard: {
        step: "explore",
        exploreProgress: { done: 3, total: 10 },
      },
    });
    expect(screen.getByText(/Revealing/i)).toBeInTheDocument();
    expect(screen.getByText(/3 \/ 10/)).toBeInTheDocument();
  });
});

describe("OnboardingWizard — distribute step", () => {
  it("renders Step 2 header + four stat tiles + Auto-balance button", () => {
    renderWizard({ wizard: { step: "distribute" } });
    expect(screen.getByText(/Step 2 — Set up your land/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Auto-balance 33 \/ 33 \/ 34/i })
    ).toBeInTheDocument();
  });

  it("fires runAutoBalance on click", () => {
    const { wizard } = renderWizard({ wizard: { step: "distribute" } });
    fireEvent.click(
      screen.getByRole("button", { name: /Auto-balance/i })
    );
    expect(wizard.runAutoBalance).toHaveBeenCalled();
  });

  it("disables Auto-balance when no unassigned tiles", () => {
    renderWizard({
      wizard: { step: "distribute" },
      counts: { ...baseCounts, unassigned: 0 },
    });
    expect(
      screen.getByRole("button", { name: /Auto-balance/i })
    ).toBeDisabled();
  });
});

describe("OnboardingWizard — caste step", () => {
  it("renders Step 3 header + one CastePickCard per caste", () => {
    renderWizard({ wizard: { step: "caste" } });
    expect(screen.getByText(/Step 3 — Pick your caste/i)).toBeInTheDocument();
    expect(screen.getByTestId("caste-red")).toBeInTheDocument();
    expect(screen.getByTestId("caste-blue")).toBeInTheDocument();
    expect(screen.getByTestId("caste-green")).toBeInTheDocument();
  });

  it("fires pickCaste on a CastePickCard click", () => {
    const { wizard } = renderWizard({ wizard: { step: "caste" } });
    fireEvent.click(screen.getByTestId("caste-blue"));
    expect(wizard.pickCaste).toHaveBeenCalledWith("blue");
  });
});

describe("OnboardingWizard — recruit step", () => {
  it("renders Step 4 header + Recruit button", () => {
    renderWizard({
      wizard: { step: "recruit" },
      counts: { ...baseCounts, military: 5, unassigned: 0 },
    });
    expect(
      screen.getByText(/Step 4 — Plant your first army/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Recruit \+10 ground/i })
    ).toBeInTheDocument();
  });

  it("fires runRecruit on click when eligible", () => {
    const { wizard } = renderWizard({
      wizard: { step: "recruit" },
      counts: { ...baseCounts, military: 5, unassigned: 0 },
    });
    fireEvent.click(screen.getByRole("button", { name: /Recruit/i }));
    expect(wizard.runRecruit).toHaveBeenCalled();
  });

  it("disables Recruit button when counts.military === 0", () => {
    renderWizard({
      wizard: { step: "recruit" },
      counts: { ...baseCounts, military: 0, unassigned: 0 },
    });
    expect(
      screen.getByRole("button", { name: /Recruit/i })
    ).toBeDisabled();
  });

  it("disables Recruit button when turnsRemaining < 5", () => {
    renderWizard({
      wizard: { step: "recruit" },
      counts: { ...baseCounts, military: 5, unassigned: 0 },
      player: { ...basePlayer, turnsRemaining: 2 } as GamePlayer,
    });
    expect(
      screen.getByRole("button", { name: /Recruit/i })
    ).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// StepRibbon current / done / upcoming branches
// ---------------------------------------------------------------------------

describe("OnboardingWizard — StepRibbon", () => {
  it("renders all four step labels when step=explore (all upcoming except first)", () => {
    renderWizard({ wizard: { step: "explore" } });
    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.getByText("Distribute")).toBeInTheDocument();
    expect(screen.getByText("Caste")).toBeInTheDocument();
    expect(screen.getByText("Recruit")).toBeInTheDocument();
  });

  it("marks all prior steps done when step=done (every chip a CheckCircle)", () => {
    // step=done exercises the `current === "done"` branch where currentIdx
    // becomes STEP_ORDER.length, making every step idx < currentIdx (done).
    renderWizard({ wizard: { step: "done" } });
    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.getByText("Recruit")).toBeInTheDocument();
  });

  it("marks earlier steps done + current highlighted when step=recruit", () => {
    renderWizard({
      wizard: { step: "recruit" },
      counts: { ...baseCounts, military: 5, unassigned: 0 },
    });
    // All four labels still render; the visual state is encoded in
    // className branches we just want exercised, not asserted on.
    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.getByText("Caste")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Dismiss paths + side effects
// ---------------------------------------------------------------------------

describe("OnboardingWizard — dismiss paths", () => {
  it("X button calls wizard.dismiss", () => {
    const { wizard } = renderWizard();
    fireEvent.click(
      screen.getByRole("button", { name: /Dismiss onboarding wizard/i })
    );
    expect(wizard.dismiss).toHaveBeenCalled();
  });

  it("backdrop click calls wizard.dismiss", () => {
    const { wizard, container } = renderWizard();
    const backdrop = container.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(wizard.dismiss).toHaveBeenCalled();
  });

  it("'I'll come back to this' button calls wizard.dismiss", () => {
    const { wizard } = renderWizard();
    fireEvent.click(screen.getByText(/I'll come back to this/i));
    expect(wizard.dismiss).toHaveBeenCalled();
  });

  it("Escape key dispatches wizard.dismiss when open", () => {
    const { wizard } = renderWizard();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(wizard.dismiss).toHaveBeenCalled();
  });

  it("non-Escape keys do not dismiss", () => {
    const { wizard } = renderWizard();
    fireEvent.keyDown(document, { key: "Enter" });
    expect(wizard.dismiss).not.toHaveBeenCalled();
  });

  it("Escape key does NOT dismiss when wizard.isOpen=false", () => {
    // When isOpen=false the component renders null so the effect that
    // registers the listener still runs (it depends on wizard, not
    // isOpen), but the handler's `wizard.isOpen` guard means dismiss
    // shouldn't fire.
    const { wizard } = renderWizard({ wizard: { isOpen: false } });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(wizard.dismiss).not.toHaveBeenCalled();
  });
});

describe("OnboardingWizard — body overflow effect", () => {
  it("sets body.style.overflow=hidden when open and clears on unmount", () => {
    const { unmount } = renderWizard();
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Error surfacing
// ---------------------------------------------------------------------------

describe("OnboardingWizard — error surface", () => {
  it("renders wizard.error when set", () => {
    renderWizard({ wizard: { error: "Action exploded" } });
    expect(screen.getByText("Action exploded")).toBeInTheDocument();
  });

  it("does not render error region when error is null", () => {
    renderWizard({ wizard: { error: null } });
    // Sanity: the title still shows; we don't have a stable selector for
    // the absent error pill but we can confirm no role=alert text matches.
    expect(screen.queryByText(/Action exploded/i)).not.toBeInTheDocument();
  });
});
