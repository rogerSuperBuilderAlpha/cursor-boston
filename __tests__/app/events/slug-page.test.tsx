/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment node
 *
 * OpenSSF Gold coverage — `app/events/[slug]/page.tsx` (24% / 41
 * uncovered branches). Targets the entry points: generateStaticParams,
 * generateMetadata (event found + event not found), and the default
 * page handler's notFound branch + happy-path render. The page itself
 * is mocked-out heavily so this only exercises top-level conditionals.
 */

const mockNotFound = jest.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

jest.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}));

jest.mock("@/content/events.json", () => ({
  upcoming: [
    {
      id: "evt-1",
      slug: "future-event",
      title: "Future Event",
      subtitle: "Subtitle",
      date: "2026-12-31",
      time: "6pm",
      location: "Boston",
      type: "meetup",
      description: "An event",
      longDescription: "A long event description",
      image: "/events/future.png",
      lumaUrl: "https://lu.ma/abc",
      lumaEventId: "abc",
      registrationRequired: true,
    },
  ],
  past: [
    {
      id: "evt-2",
      slug: "past-event",
      title: "Past Event",
      date: "2025-01-01",
      time: "6pm",
      location: "Boston",
      type: "meetup",
      description: "An old event",
      image: "/events/past.png",
      lumaUrl: "https://lu.ma/old",
      lumaEventId: "old",
      registrationRequired: false,
    },
  ],
  oldEvents: [],
}));

jest.mock("@/lib/pydata-2026", () => ({
  PYDATA_2026_EVENT_SLUG: "cursor-boston-pydata-2026",
  PYDATA_2026_LUMA_URL: "https://lu.ma/pydata",
}));

jest.mock("@/lib/luma-event", () => ({
  getLumaCheckoutEventId: jest.fn(() => "luma-id"),
  getLumaCheckoutHref: jest.fn(() => "https://lu.ma/checkout"),
}));

jest.mock("@/components/events/CoworkingSlots", () => ({
  __esModule: true,
  default: () => null,
}));

import EventPage, {
  generateMetadata,
  generateStaticParams,
} from "@/app/events/[slug]/page";

function params(slug: string) {
  return Promise.resolve({ slug });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("events/[slug] generateStaticParams", () => {
  it("returns slugs for all events (upcoming + past)", async () => {
    const result = await generateStaticParams();
    const slugs = result.map((p: { slug: string }) => p.slug);
    expect(slugs).toContain("future-event");
    expect(slugs).toContain("past-event");
  });

  it("excludes the pydata-2026 slug", async () => {
    const result = await generateStaticParams();
    const slugs = result.map((p: { slug: string }) => p.slug);
    expect(slugs).not.toContain("cursor-boston-pydata-2026");
  });
});

describe("events/[slug] generateMetadata", () => {
  it("returns 'Event Not Found' title when slug is unknown", async () => {
    const meta = await generateMetadata({ params: params("nonexistent") });
    expect(meta.title).toBe("Event Not Found");
  });

  it("returns full metadata for an existing event", async () => {
    const meta = await generateMetadata({ params: params("future-event") });
    expect(meta.title).toMatch(/Future Event/);
    expect(meta.description).toBe("An event");
    expect(meta.openGraph?.title).toBe("Future Event");
    expect(meta.alternates?.canonical).toContain("future-event");
  });
});

describe("events/[slug] EventPage", () => {
  it("calls notFound when slug doesn't match any event", async () => {
    await expect(EventPage({ params: params("ghost") })).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("renders the event page for an existing upcoming event without throwing", async () => {
    const result = await EventPage({ params: params("future-event") });
    expect(result).toBeTruthy();
  });

  it("renders the event page for a past event without throwing", async () => {
    const result = await EventPage({ params: params("past-event") });
    expect(result).toBeTruthy();
  });
});
