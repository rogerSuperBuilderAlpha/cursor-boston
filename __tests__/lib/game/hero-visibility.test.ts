/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  applyEventVisibility,
  applyHeroVisibility,
  isHeroFullyPublic,
} from "@/lib/game/hero-visibility";
import type { GameHeroDoc, GameHeroEvent } from "@/lib/game/types";

function liveHero(overrides: Partial<GameHeroDoc> = {}): GameHeroDoc {
  return {
    id: "hero-1",
    name: "Dame Lyric",
    class: "military",
    specialty: "ground",
    caste: "white",
    currentOwnerId: "owner-a",
    currentTileId: "q3_r4",
    stamina: 80,
    staminaMax: 100,
    isDeceased: false,
    awaitingResurrection: false,
    emergedAtTurn: 12,
    emergedSeasonNumber: 1,
    survivedSeasons: [],
    lastEventAt: new Date("2026-05-15T10:00:00Z"),
    createdAt: new Date("2026-05-01T10:00:00Z"),
    updatedAt: new Date("2026-05-15T10:00:00Z"),
    ...overrides,
  };
}

function deceasedHero(overrides: Partial<GameHeroDoc> = {}): GameHeroDoc {
  return liveHero({
    isDeceased: true,
    currentOwnerId: null,
    currentTileId: null,
    deceasedTileId: "q5_r5",
    deceasedAt: new Date("2026-05-10T10:00:00Z"),
    stamina: 0,
    ...overrides,
  });
}

function event(
  overrides: Partial<GameHeroEvent> = {}
): Pick<GameHeroEvent, "ownerIdAtTime"> {
  return {
    ownerIdAtTime: "owner-a",
    ...overrides,
  };
}

describe("isHeroFullyPublic", () => {
  it("is true for deceased heroes", () => {
    expect(isHeroFullyPublic(deceasedHero())).toBe(true);
  });
  it("is true for past-season (awaiting resurrection) heroes", () => {
    expect(
      isHeroFullyPublic(liveHero({ awaitingResurrection: true }))
    ).toBe(true);
  });
  it("is false for living, in-play heroes", () => {
    expect(isHeroFullyPublic(liveHero())).toBe(false);
  });
});

describe("applyHeroVisibility — living hero", () => {
  const neighbors = (): ReadonlySet<string> => new Set<string>();
  const adjacentNeighbors = (): ReadonlySet<string> => new Set(["q3_r4"]);

  it("identity fields are always visible to any viewer", () => {
    const safe = applyHeroVisibility(liveHero(), "random-viewer", neighbors());
    expect(safe.id).toBe("hero-1");
    expect(safe.name).toBe("Dame Lyric");
    expect(safe.class).toBe("military");
    expect(safe.caste).toBe("white");
    expect(safe.currentOwnerId).toBe("owner-a");
    expect(safe.isDeceased).toBe(false);
    expect(safe.emergedSeasonNumber).toBe(1);
  });

  it("hides currentTileId + stamina from a random viewer with no adjacency", () => {
    const safe = applyHeroVisibility(liveHero(), "random-viewer", neighbors());
    expect(safe.currentTileId).toBeUndefined();
    expect(safe.stamina).toBeUndefined();
    expect(safe.staminaMax).toBeUndefined();
  });

  it("reveals currentTileId + stamina to the current owner", () => {
    const safe = applyHeroVisibility(liveHero(), "owner-a", neighbors());
    expect(safe.currentTileId).toBe("q3_r4");
    expect(safe.stamina).toBe(80);
    expect(safe.staminaMax).toBe(100);
  });

  it("reveals currentTileId + stamina to a viewer adjacent to the hero", () => {
    const safe = applyHeroVisibility(
      liveHero(),
      "neighbor-viewer",
      adjacentNeighbors()
    );
    expect(safe.currentTileId).toBe("q3_r4");
    expect(safe.stamina).toBe(80);
  });

  it("does not surface a deceasedTileId on a living hero", () => {
    const safe = applyHeroVisibility(liveHero(), "owner-a", neighbors());
    expect(safe.deceasedTileId).toBeUndefined();
  });
});

describe("applyHeroVisibility — deceased / past-season hero", () => {
  it("reveals deceasedTileId to a random viewer", () => {
    const safe = applyHeroVisibility(
      deceasedHero(),
      "random-viewer",
      new Set<string>()
    );
    expect(safe.deceasedTileId).toBe("q5_r5");
    expect(safe.stamina).toBe(0);
  });

  it("reveals location for past-season (in-limbo) heroes", () => {
    const limbo = liveHero({
      awaitingResurrection: true,
      currentTileId: null,
    });
    const safe = applyHeroVisibility(limbo, "random-viewer", new Set<string>());
    // currentTileId is null on a limbo hero — safe.currentTileId omitted.
    expect(safe.currentTileId).toBeUndefined();
    // Stamina is fully public on past-season heroes.
    expect(safe.stamina).toBe(80);
  });
});

describe("applyEventVisibility", () => {
  it("returns true for all events when the hero is fully public", () => {
    expect(
      applyEventVisibility(event({ ownerIdAtTime: "someone-else" }), "viewer", true)
    ).toBe(true);
    expect(
      applyEventVisibility(event({ ownerIdAtTime: null }), "viewer", true)
    ).toBe(true);
  });

  it("filters living-hero events to the viewer's tenure", () => {
    expect(
      applyEventVisibility(event({ ownerIdAtTime: "viewer" }), "viewer", false)
    ).toBe(true);
    expect(
      applyEventVisibility(event({ ownerIdAtTime: "other-owner" }), "viewer", false)
    ).toBe(false);
    expect(
      applyEventVisibility(event({ ownerIdAtTime: null }), "viewer", false)
    ).toBe(false);
  });
});
