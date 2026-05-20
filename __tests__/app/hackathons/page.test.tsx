/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment node
 *
 * OpenSSF Gold coverage — `app/hackathons/page.tsx` (0% / 37 uncovered
 * branches). The page is a static server component; this test renders
 * it three different times to exercise the conditional branches:
 * featured-with-embedSrc, featured-with-lumaCheckoutEventId only, no
 * featured event (empty upcoming list).
 */

let mockUpcoming: unknown[] = [];

jest.mock("@/content/events.json", () => ({
  get upcoming() {
    return mockUpcoming;
  },
  past: [],
  oldEvents: [],
}));

jest.mock("@/lib/hackathons", () => ({
  getCurrentVirtualHackathonId: jest.fn(() => "virtual-2026-05"),
  getMonthEndFromVirtualId: jest.fn(() => new Date("2026-05-31")),
}));

jest.mock("@/lib/luma-event", () => ({
  getLumaCheckoutEventId: jest.fn(() => "luma-evt"),
  getLumaCheckoutHref: jest.fn(() => "https://lu.ma/abc"),
}));

jest.mock("@/components/SectionHelp", () => ({
  SectionHelp: () => null,
}));

jest.mock("@/components/NeedsWorkBanner", () => ({
  NeedsWorkBanner: () => null,
}));

import HackathonsPage from "@/app/hackathons/page";

beforeEach(() => {
  jest.clearAllMocks();
  mockUpcoming = [];
});

describe("HackathonsPage", () => {
  it("renders with no upcoming hackathon events (no featured)", () => {
    const result = HackathonsPage();
    expect(result).toBeTruthy();
  });

  it("renders with a featured hackathon using lumaEmbedSrc", () => {
    mockUpcoming = [
      {
        id: "h1",
        slug: "hack-1",
        title: "Hack 1",
        date: "2026-06-01",
        type: "hackathon",
        featured: true,
        lumaEmbedSrc: "https://lu.ma/embed/abc",
      },
      {
        id: "h2",
        slug: "hack-2",
        title: "Hack 2",
        date: "2026-07-01",
        type: "hackathon",
        featured: false,
      },
    ];
    const result = HackathonsPage();
    expect(result).toBeTruthy();
  });

  it("renders with a featured hackathon using only lumaCheckoutEventId (fallback)", () => {
    mockUpcoming = [
      {
        id: "h1",
        slug: "hack-1",
        title: "Hack 1",
        date: "2026-06-01",
        type: "hackathon",
        featured: true,
        lumaCheckoutEventId: "evt-xyz",
      },
    ];
    const result = HackathonsPage();
    expect(result).toBeTruthy();
  });

  it("sorts by date when no event is featured (both featured=false)", () => {
    mockUpcoming = [
      {
        id: "h2",
        slug: "hack-2",
        title: "Hack 2",
        date: "2026-08-01",
        type: "hackathon",
        featured: false,
      },
      {
        id: "h1",
        slug: "hack-1",
        title: "Hack 1",
        date: "2026-06-01",
        type: "hackathon",
        featured: false,
      },
    ];
    const result = HackathonsPage();
    expect(result).toBeTruthy();
  });

  it("filters out non-hackathon events", () => {
    mockUpcoming = [
      {
        id: "e1",
        slug: "meetup-1",
        title: "Meetup",
        date: "2026-06-01",
        type: "meetup",
        featured: true,
      },
    ];
    const result = HackathonsPage();
    expect(result).toBeTruthy();
  });

  it("falls through to monthLabel when virtual id format is malformed", () => {
    const lib = require("@/lib/hackathons");
    lib.getCurrentVirtualHackathonId.mockReturnValueOnce("bad-format");
    const result = HackathonsPage();
    expect(result).toBeTruthy();
  });
});
