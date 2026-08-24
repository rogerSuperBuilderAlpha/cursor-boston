/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 *
 * @jest-environment node
 */

import {
  deriveRsvpSnapshot,
  eventRsvpDocId,
  eventSupportsOnSiteRsvp,
  getOnSiteRsvpEvent,
} from "@/lib/event-rsvp-core";

describe("deriveRsvpSnapshot", () => {
  it("confirms the first N RSVPs and waitlists the rest in createdAt order", () => {
    const active = [
      { userId: "a", createdAtMs: 30 },
      { userId: "b", createdAtMs: 10 },
      { userId: "c", createdAtMs: 20 },
    ];
    expect(deriveRsvpSnapshot(active, 2, "b")).toEqual({
      capacity: 2,
      confirmedCount: 2,
      waitlistCount: 1,
      remaining: 0,
      myStatus: "confirmed",
      waitlistPosition: null,
    });
    expect(deriveRsvpSnapshot(active, 2, "a")).toEqual({
      capacity: 2,
      confirmedCount: 2,
      waitlistCount: 1,
      remaining: 0,
      myStatus: "waitlisted",
      waitlistPosition: 1,
    });
  });

  it("returns none when the user has not RSVPed", () => {
    expect(deriveRsvpSnapshot([], 50, "u1").myStatus).toBe("none");
    expect(deriveRsvpSnapshot([], 50, null).remaining).toBe(50);
  });
});

describe("eventSupportsOnSiteRsvp", () => {
  it("rejects specialized hackathon and PyData slugs even if flagged", () => {
    expect(
      eventSupportsOnSiteRsvp({
        slug: "cursor-boston-pydata-2026",
        capacity: 150,
        onSiteRsvp: true,
      })
    ).toBe(false);
    expect(
      eventSupportsOnSiteRsvp({
        slug: "cursor-boston-sports-hack-2026",
        capacity: 119,
        onSiteRsvp: true,
      })
    ).toBe(false);
  });

  it("accepts opted-in catalog events with capacity", () => {
    expect(
      eventSupportsOnSiteRsvp({
        slug: "cafe-cursor-boston",
        capacity: 50,
        onSiteRsvp: true,
      })
    ).toBe(true);
  });
});

describe("getOnSiteRsvpEvent", () => {
  it("resolves the Cafe Cursor catalog event", () => {
    const event = getOnSiteRsvpEvent("cafe-cursor-boston-2026");
    expect(event?.slug).toBe("cafe-cursor-boston");
    expect(event?.capacity).toBe(50);
  });

  it("returns null for specialized events", () => {
    expect(getOnSiteRsvpEvent("cursor-boston-pydata-2026")).toBeNull();
  });
});

describe("eventRsvpDocId", () => {
  it("namespaces the document by event and user", () => {
    expect(eventRsvpDocId("cafe-cursor-boston-2026", "uid-1")).toBe(
      "cafe-cursor-boston-2026__uid-1"
    );
  });
});
