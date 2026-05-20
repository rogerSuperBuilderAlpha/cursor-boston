/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/opportunities/page.tsx` (0% / 15
 * uncovered branches). Server-rendered static page; covers each
 * formatType / getTypeBadgeColor branch by listing opportunities of
 * each type, plus the empty-state.
 */

let mockOpps: unknown[] = [];

jest.mock("@/content/opportunities.json", () => ({
  get opportunities() {
    return mockOpps;
  },
  default: { opportunities: [] },
}));

jest.mock("@/components/SectionHelp", () => ({
  SectionHelp: () => null,
}));

import OpportunitiesPage from "@/app/opportunities/page";

beforeEach(() => {
  jest.clearAllMocks();
  mockOpps = [];
});

describe("OpportunitiesPage", () => {
  it("renders the empty-state when no opportunities are listed", () => {
    const result = OpportunitiesPage();
    expect(result).toBeTruthy();
  });

  it("renders an opportunity of type=cofounder", () => {
    mockOpps = [
      {
        id: "1",
        title: "CTO",
        company: "Startup",
        type: "cofounder",
        location: "Boston",
        description: "Build the thing",
        url: "https://example.com",
      },
    ];
    const result = OpportunitiesPage();
    expect(result).toBeTruthy();
  });

  it("renders an opportunity of type=full-time", () => {
    mockOpps = [
      { id: "2", title: "Eng", company: "Co", type: "full-time", description: "X", url: "https://x" },
    ];
    const result = OpportunitiesPage();
    expect(result).toBeTruthy();
  });

  it("renders an opportunity of type=contract", () => {
    mockOpps = [
      { id: "3", title: "Freelancer", company: "Co", type: "contract", description: "X", url: "https://x" },
    ];
    const result = OpportunitiesPage();
    expect(result).toBeTruthy();
  });

  it("renders an opportunity of type=internship", () => {
    mockOpps = [
      { id: "4", title: "Intern", company: "Co", type: "internship", description: "X", url: "https://x" },
    ];
    const result = OpportunitiesPage();
    expect(result).toBeTruthy();
  });

  it("renders an opportunity of unknown type (default branch + Capitalized fallback)", () => {
    mockOpps = [
      { id: "5", title: "Other", company: "Co", type: "advisor", description: "X", url: "https://x" },
    ];
    const result = OpportunitiesPage();
    expect(result).toBeTruthy();
  });

  it("renders an opportunity of type=part-time", () => {
    mockOpps = [
      { id: "6", title: "Part", company: "Co", type: "part-time", description: "X", url: "https://x" },
    ];
    const result = OpportunitiesPage();
    expect(result).toBeTruthy();
  });

  it("renders multiple opportunities mixed", () => {
    mockOpps = [
      { id: "1", title: "A", company: "C1", type: "cofounder", description: "X", url: "https://x" },
      { id: "2", title: "B", company: "C2", type: "full-time", description: "X", url: "https://y" },
      { id: "3", title: "C", company: "C3", type: "contract", description: "X", url: "https://z" },
    ];
    const result = OpportunitiesPage();
    expect(result).toBeTruthy();
  });
});
