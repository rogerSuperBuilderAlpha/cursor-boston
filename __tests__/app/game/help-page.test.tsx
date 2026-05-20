/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/help/page.tsx` was at 50% branches
 * (10 uncovered). Covers the Suspense fallback boundary, default tab
 * fallback, each tab branch (resolveTabId → conditional render), the
 * setTab → router.replace flow including merging existing query params,
 * and the dashboard / leaderboard quick-link footer.
 */

import React, { Suspense } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

// Mock next/navigation BEFORE importing the page; the page reads from these
// hooks at render time. We use module-scoped controls so each test can swap
// behavior between tab values and to inspect router.replace calls.
const replaceMock = jest.fn();
let mockTab: string | null = null;
let mockOtherParam: string | null = null;

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: replaceMock,
    back: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => {
    const p = new URLSearchParams();
    if (mockTab !== null) p.set("tab", mockTab);
    if (mockOtherParam !== null) p.set("ref", mockOtherParam);
    return p;
  },
  usePathname: () => "/game/help",
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    require("react").createElement("a", { href }, children),
}));

// Stub each tab body so the test isolates the page's switching logic
// (and doesn't transitively pull in copy + sub-components we don't own).
jest.mock("@/app/game/help/_components/tabs/OverviewTab", () => ({
  OverviewTab: () => <div data-testid="tab-overview">overview-body</div>,
}));
jest.mock("@/app/game/help/_components/tabs/PhasesTab", () => ({
  PhasesTab: () => <div data-testid="tab-phases">phases-body</div>,
}));
jest.mock("@/app/game/help/_components/tabs/CastesTab", () => ({
  CastesTab: () => <div data-testid="tab-castes">castes-body</div>,
}));
jest.mock("@/app/game/help/_components/tabs/CombatTab", () => ({
  CombatTab: () => <div data-testid="tab-combat">combat-body</div>,
}));
jest.mock("@/app/game/help/_components/tabs/HeroesTab", () => ({
  HeroesTab: () => <div data-testid="tab-heroes">heroes-body</div>,
}));
jest.mock("@/app/game/help/_components/tabs/EndgameTab", () => ({
  EndgameTab: () => <div data-testid="tab-endgame">endgame-body</div>,
}));
jest.mock("@/app/game/help/_components/tabs/CommunityTab", () => ({
  CommunityTab: () => <div data-testid="tab-community">community-body</div>,
}));
jest.mock("@/app/game/help/_components/tabs/WorldTab", () => ({
  WorldTab: () => <div data-testid="tab-world">world-body</div>,
}));
jest.mock("@/app/game/help/_components/tabs/ContributorTab", () => ({
  ContributorTab: () => <div data-testid="tab-contributor">contributor-body</div>,
}));

import GameHelpPage from "@/app/game/help/page";

beforeEach(() => {
  replaceMock.mockClear();
  mockTab = null;
  mockOtherParam = null;
});

describe("GameHelpPage", () => {
  it("renders the Overview tab by default when no ?tab=... is present", () => {
    render(<GameHelpPage />);
    expect(screen.getByText("Generals — How to play")).toBeInTheDocument();
    expect(screen.getByTestId("tab-overview")).toBeInTheDocument();
    // No other tabs render
    expect(screen.queryByTestId("tab-combat")).not.toBeInTheDocument();
  });

  it("falls back to overview when ?tab is unknown", () => {
    mockTab = "garbage-tab-name";
    render(<GameHelpPage />);
    expect(screen.getByTestId("tab-overview")).toBeInTheDocument();
  });

  it.each([
    ["phases", "tab-phases"],
    ["castes", "tab-castes"],
    ["combat", "tab-combat"],
    ["heroes", "tab-heroes"],
    ["endgame", "tab-endgame"],
    ["community", "tab-community"],
    ["world", "tab-world"],
    ["contributor", "tab-contributor"],
  ])("renders the %s tab when ?tab=%s", (tab, testId) => {
    mockTab = tab;
    render(<GameHelpPage />);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  it("clicking a tab pushes tab=<id> via router.replace and merges existing params", () => {
    mockOtherParam = "from-email";
    render(<GameHelpPage />);
    // Click "Combat" tab in the TabBar (real component, no mock).
    fireEvent.click(screen.getByRole("tab", { name: "Combat" }));
    expect(replaceMock).toHaveBeenCalledTimes(1);
    const url = replaceMock.mock.calls[0][0] as string;
    expect(url).toContain("/game/help?");
    // Order isn't guaranteed across URLSearchParams iterations; assert each.
    expect(url).toContain("tab=combat");
    expect(url).toContain("ref=from-email");
    // scroll: false option
    expect(replaceMock.mock.calls[0][1]).toEqual({ scroll: false });
  });

  it("clicking a tab works when no other query params exist", () => {
    render(<GameHelpPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Endgame" }));
    expect(replaceMock).toHaveBeenCalledWith(
      "/game/help?tab=endgame",
      { scroll: false }
    );
  });

  it("renders the Dashboard and Leaderboard footer links", () => {
    render(<GameHelpPage />);
    const dashLinks = screen.getAllByRole("link", { name: /Dashboard/i });
    // One in the header (← Dashboard) and one in the footer (← Back to dashboard)
    expect(dashLinks.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("link", { name: /Leaderboard/i })).toHaveAttribute(
      "href",
      "/game/leaderboard"
    );
  });

  it("renders the intro copy", () => {
    render(<GameHelpPage />);
    expect(
      screen.getByText(/Generals is a slow, persistent, turn-based strategy game/i)
    ).toBeInTheDocument();
  });

  it("wraps content in a Suspense boundary (component is callable directly)", () => {
    // Smoke-test the default export — confirms the Suspense wrapper renders
    // its child synchronously (the inner component is a function component
    // with no thrown promises, so it resolves on first render).
    const { container } = render(
      <Suspense fallback={<div data-testid="fallback" />}>
        <GameHelpPage />
      </Suspense>
    );
    expect(container.querySelector('[data-testid="tab-overview"]')).toBeInTheDocument();
  });
});
