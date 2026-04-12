/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  getCurrentVirtualHackathonId,
  getVirtualHackathonIdForDate,
  isVirtualHackathonId,
  getMonthEndFromVirtualId,
  getVirtualMonthStartEndUtc,
  getCurrentVirtualMonthStart,
  getCurrentVirtualMonthEnd,
  getSubmissionCutoffForMonth,
} from "@/lib/hackathons";

describe("isVirtualHackathonId", () => {
  it("returns true for valid virtual IDs", () => {
    expect(isVirtualHackathonId("virtual-2025-01")).toBe(true);
    expect(isVirtualHackathonId("virtual-2026-12")).toBe(true);
  });

  it("returns false for invalid formats", () => {
    expect(isVirtualHackathonId("virtual-2025-1")).toBe(false);
    expect(isVirtualHackathonId("hack-a-sprint-2026")).toBe(false);
    expect(isVirtualHackathonId("virtual-25-01")).toBe(false);
    expect(isVirtualHackathonId("")).toBe(false);
  });
});

describe("getCurrentVirtualHackathonId", () => {
  it("returns a valid virtual hackathon ID", () => {
    const id = getCurrentVirtualHackathonId();
    expect(isVirtualHackathonId(id)).toBe(true);
  });

  it("matches the virtual-YYYY-MM pattern", () => {
    const id = getCurrentVirtualHackathonId();
    expect(id).toMatch(/^virtual-\d{4}-\d{2}$/);
  });
});

describe("getVirtualHackathonIdForDate", () => {
  it("returns correct ID for a known date", () => {
    const date = new Date("2026-03-15T12:00:00Z");
    const id = getVirtualHackathonIdForDate(date);
    expect(id).toBe("virtual-2026-03");
  });

  it("returns correct ID for January", () => {
    const date = new Date("2025-01-01T12:00:00Z");
    const id = getVirtualHackathonIdForDate(date);
    expect(id).toBe("virtual-2025-01");
  });
});

describe("getMonthEndFromVirtualId", () => {
  it("returns last day of January", () => {
    const end = getMonthEndFromVirtualId("virtual-2026-01");
    expect(end.getDate()).toBe(31);
    expect(end.getMonth()).toBe(0); // January
    expect(end.getFullYear()).toBe(2026);
  });

  it("returns last day of February (non-leap year)", () => {
    const end = getMonthEndFromVirtualId("virtual-2025-02");
    expect(end.getDate()).toBe(28);
  });

  it("returns last day of February (leap year)", () => {
    const end = getMonthEndFromVirtualId("virtual-2028-02");
    expect(end.getDate()).toBe(29);
  });

  it("returns current date for invalid ID", () => {
    const end = getMonthEndFromVirtualId("invalid");
    expect(end).toBeInstanceOf(Date);
  });
});

describe("getVirtualMonthStartEndUtc", () => {
  it("returns null for invalid ID", () => {
    expect(getVirtualMonthStartEndUtc("invalid")).toBeNull();
  });

  it("returns start and end dates for valid ID", () => {
    const result = getVirtualMonthStartEndUtc("virtual-2026-03");
    expect(result).not.toBeNull();
    expect(result!.start).toBeInstanceOf(Date);
    expect(result!.end).toBeInstanceOf(Date);
    expect(result!.start.getTime()).toBeLessThan(result!.end.getTime());
  });

  it("start is on the 1st of the month", () => {
    const result = getVirtualMonthStartEndUtc("virtual-2026-06");
    expect(result).not.toBeNull();
    expect(result!.start.getUTCDate()).toBe(1);
  });
});

describe("getCurrentVirtualMonthStart", () => {
  it("returns the 1st of the current month", () => {
    const start = getCurrentVirtualMonthStart();
    expect(start.getDate()).toBe(1);
  });
});

describe("getCurrentVirtualMonthEnd", () => {
  it("returns a date after getCurrentVirtualMonthStart", () => {
    const start = getCurrentVirtualMonthStart();
    const end = getCurrentVirtualMonthEnd();
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });

  it("end time is 23:59:59", () => {
    const end = getCurrentVirtualMonthEnd();
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
  });
});

describe("getSubmissionCutoffForMonth", () => {
  it("cutoff for January 2026 is start of February 2026 UTC", () => {
    const cutoff = getSubmissionCutoffForMonth(2026, 1);
    expect(cutoff.getUTCMonth()).toBe(1); // February
    expect(cutoff.getUTCDate()).toBe(1);
    expect(cutoff.getUTCFullYear()).toBe(2026);
  });

  it("cutoff for December wraps to January of next year", () => {
    const cutoff = getSubmissionCutoffForMonth(2025, 12);
    expect(cutoff.getUTCMonth()).toBe(0); // January
    expect(cutoff.getUTCFullYear()).toBe(2026);
  });

  it("cutoff hour accounts for Boston timezone offset (4 or 5 UTC)", () => {
    const cutoff = getSubmissionCutoffForMonth(2026, 6);
    // Boston is EDT (UTC-4) in June, so cutoff should be 04:00 UTC
    expect(cutoff.getUTCHours()).toBe(4);
  });
});
