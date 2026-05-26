/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/ecosystem/page.tsx` (0% / 11 uncovered
 * branches). Covers all-categories render, category filter for each
 * Category value, entry detail rendering, empty-entries edge case.
 */

import { fireEvent, render, screen } from "@testing-library/react";

let mockEntries: unknown[] = [];

jest.mock("@/content/ecosystem.json", () => ({
  get entries() {
    return mockEntries;
  },
  default: { entries: [] },
}));

import EcosystemPage from "@/app/ecosystem/page";

beforeEach(() => {
  jest.clearAllMocks();
  mockEntries = [
    {
      id: "1",
      name: "MIT",
      fullName: "Massachusetts Institute of Technology",
      category: "university",
      location: "Cambridge",
      website: "https://mit.edu",
      description: "Research university",
      tags: ["research"],
    },
    {
      id: "2",
      name: "YC",
      fullName: "Y Combinator",
      category: "accelerator",
      location: "Mountain View",
      website: "https://yc.com",
      description: "Startup accelerator",
      tags: ["startup"],
    },
    {
      id: "3",
      name: "OpenAI",
      fullName: "OpenAI",
      category: "ai_org",
      location: "San Francisco",
      website: "https://openai.com",
      description: "AI lab",
      tags: ["ai"],
    },
    {
      id: "4",
      name: "Sequoia",
      fullName: "Sequoia Capital",
      category: "vc",
      location: "Menlo Park",
      website: "https://sequoia.com",
      description: "VC",
      tags: ["vc"],
    },
    {
      id: "5",
      name: "DeepMind",
      fullName: "DeepMind",
      category: "research_lab",
      location: "London",
      website: "https://deepmind.com",
      description: "Research lab",
      tags: ["ai"],
    },
    {
      id: "6",
      name: "MAS",
      fullName: "Mass AI Society",
      category: "nonprofit",
      location: "Boston",
      website: "https://mas.org",
      description: "Nonprofit",
      tags: ["community"],
    },
  ];
});

describe("EcosystemPage", () => {
  it("renders all entries when category=all (default)", () => {
    render(<EcosystemPage />);
    expect(screen.getByText("MIT")).toBeInTheDocument();
    expect(screen.getByText("YC")).toBeInTheDocument();
    expect(screen.getAllByText("OpenAI").length).toBeGreaterThan(0);
  });

  it("filters to universities only", () => {
    render(<EcosystemPage />);
    fireEvent.click(screen.getByRole("button", { name: /Universities/i }));
    expect(screen.getByText("MIT")).toBeInTheDocument();
    expect(screen.queryByText("YC")).not.toBeInTheDocument();
  });

  it("filters to accelerators only", () => {
    render(<EcosystemPage />);
    fireEvent.click(screen.getByRole("button", { name: /Accelerators/i }));
    expect(screen.getByText("YC")).toBeInTheDocument();
    expect(screen.queryByText("MIT")).not.toBeInTheDocument();
  });

  it("filters to AI organizations only", () => {
    render(<EcosystemPage />);
    fireEvent.click(screen.getByRole("button", { name: /AI organizations/i }));
    expect(screen.getAllByText("OpenAI").length).toBeGreaterThan(0);
  });

  it("filters to venture capital only", () => {
    render(<EcosystemPage />);
    fireEvent.click(screen.getByRole("button", { name: /Venture capital/i }));
    expect(screen.getByText("Sequoia")).toBeInTheDocument();
  });

  it("filters to research labs only", () => {
    render(<EcosystemPage />);
    fireEvent.click(screen.getByRole("button", { name: /Research labs/i }));
    expect(screen.getAllByText("DeepMind").length).toBeGreaterThan(0);
  });

  it("filters to nonprofits only", () => {
    render(<EcosystemPage />);
    fireEvent.click(screen.getByRole("button", { name: /Nonprofits/i }));
    expect(screen.getByText("MAS")).toBeInTheDocument();
  });

  it("clicking All returns to showing every entry", () => {
    render(<EcosystemPage />);
    fireEvent.click(screen.getByRole("button", { name: /Universities/i }));
    fireEvent.click(screen.getByRole("button", { name: /^All/i }));
    expect(screen.getByText("MIT")).toBeInTheDocument();
    expect(screen.getByText("YC")).toBeInTheDocument();
  });

  it("renders entry details (location, website, description, tags)", () => {
    render(<EcosystemPage />);
    expect(screen.getByText(/Cambridge/)).toBeInTheDocument();
    expect(screen.getByText(/Research university/)).toBeInTheDocument();
    expect(screen.getAllByText("research").length).toBeGreaterThan(0);
  });

  it("renders correctly when there are no entries", () => {
    mockEntries = [];
    render(<EcosystemPage />);
    expect(screen.getByText(/Mass AI Ecosystem/)).toBeInTheDocument();
  });
});
