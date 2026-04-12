/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  BADGE_DEFINITIONS,
  BADGE_IDS,
  BADGE_DEFINITIONS_BY_ID,
} from "@/lib/badges/definitions";
import type { BadgeId, BadgeCategory } from "@/lib/badges/types";

const VALID_CATEGORIES: BadgeCategory[] = [
  "onboarding",
  "community",
  "events",
  "contributions",
  "mentorship",
];

describe("BADGE_DEFINITIONS", () => {
  it("contains at least one badge", () => {
    expect(BADGE_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it("every badge has required fields", () => {
    for (const badge of BADGE_DEFINITIONS) {
      expect(badge.id).toBeTruthy();
      expect(badge.name).toBeTruthy();
      expect(badge.description).toBeTruthy();
      expect(badge.howToEarn).toBeTruthy();
      expect(typeof badge.sortOrder).toBe("number");
      expect(VALID_CATEGORIES).toContain(badge.category);
    }
  });

  it("has unique badge IDs", () => {
    const ids = BADGE_DEFINITIONS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique sort orders", () => {
    const orders = BADGE_DEFINITIONS.map((b) => b.sortOrder);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("sort orders are sequential starting from 1", () => {
    const sorted = [...BADGE_DEFINITIONS].sort(
      (a, b) => a.sortOrder - b.sortOrder
    );
    sorted.forEach((badge, i) => {
      expect(badge.sortOrder).toBe(i + 1);
    });
  });
});

describe("BADGE_IDS", () => {
  it("matches the IDs from BADGE_DEFINITIONS", () => {
    const definitionIds = BADGE_DEFINITIONS.map((b) => b.id);
    expect(BADGE_IDS).toEqual(definitionIds);
  });

  it("contains known badge IDs", () => {
    const knownIds: BadgeId[] = [
      "first-steps",
      "connected",
      "speaker",
      "hacker",
      "contributor",
    ];
    for (const id of knownIds) {
      expect(BADGE_IDS).toContain(id);
    }
  });
});

describe("BADGE_DEFINITIONS_BY_ID", () => {
  it("has an entry for every badge ID", () => {
    for (const id of BADGE_IDS) {
      expect(BADGE_DEFINITIONS_BY_ID[id]).toBeDefined();
      expect(BADGE_DEFINITIONS_BY_ID[id].id).toBe(id);
    }
  });

  it("lookup returns the correct badge", () => {
    const badge = BADGE_DEFINITIONS_BY_ID["contributor"];
    expect(badge.name).toBe("Contributor");
    expect(badge.category).toBe("contributions");
  });
});
