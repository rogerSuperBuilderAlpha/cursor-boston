/**
 * @jest-environment node
 */
import { derivePlayerTitles } from "@/lib/game/titles";
import type { GamePlayer } from "@/lib/game/types";

const basePlayer = (overrides: Partial<GamePlayer> = {}): GamePlayer =>
  ({
    stats: {},
    ...overrides,
  } as unknown as GamePlayer);

describe("game/titles — derivePlayerTitles", () => {
  it("returns empty for a new player with no milestones", () => {
    expect(derivePlayerTitles(basePlayer())).toEqual([]);
  });

  describe("tiles tier", () => {
    it("awards Tile Knight at 100", () => {
      const titles = derivePlayerTitles(basePlayer({ stats: { tilesHeld: 100 } } as unknown as Partial<GamePlayer>));
      expect(titles.map((t) => t.id)).toContain("tile-knight-100");
    });

    it("upgrades to Tile Lord at 500", () => {
      const titles = derivePlayerTitles(basePlayer({ stats: { tilesHeld: 500 } } as unknown as Partial<GamePlayer>));
      expect(titles.map((t) => t.id)).toContain("tile-lord-500");
      expect(titles.map((t) => t.id)).not.toContain("tile-knight-100");
    });

    it("upgrades to Tile Baron at 1000+", () => {
      const titles = derivePlayerTitles(basePlayer({ stats: { tilesHeld: 1500 } } as unknown as Partial<GamePlayer>));
      expect(titles.map((t) => t.id)).toContain("tile-baron-1k");
    });
  });

  describe("attacks tier", () => {
    it("awards First Blood at 1", () => {
      const titles = derivePlayerTitles(basePlayer({ stats: { attacksWon: 1 } } as unknown as Partial<GamePlayer>));
      expect(titles.map((t) => t.id)).toContain("first-blood");
    });

    it("upgrades to Warlord at 500", () => {
      const titles = derivePlayerTitles(basePlayer({ stats: { attacksWon: 500 } } as unknown as Partial<GamePlayer>));
      expect(titles.map((t) => t.id)).toContain("warlord-500");
    });
  });

  describe("turns tier", () => {
    it("awards Veteran General at 10000+", () => {
      const titles = derivePlayerTitles(basePlayer({ turnsSpentTotal: 10_000 }));
      expect(titles.map((t) => t.id)).toContain("veteran-10k");
    });

    it("awards Campaigner at 1000-9999", () => {
      const titles = derivePlayerTitles(basePlayer({ turnsSpentTotal: 1_000 }));
      expect(titles.map((t) => t.id)).toContain("campaigner-1k");
    });
  });

  describe("sealbreaker", () => {
    it("Sealbreaker (singular) at 1 seal", () => {
      const titles = derivePlayerTitles(basePlayer({ armageddonSealsBroken: 1 }));
      const t = titles.find((x) => x.id === "sealbreaker");
      expect(t?.label).toBe("Sealbreaker");
      expect(t?.description).toContain("1 Armageddon seal.");
    });

    it("Sealbreaker (plural) at 2 seals", () => {
      const titles = derivePlayerTitles(basePlayer({ armageddonSealsBroken: 2 }));
      const t = titles.find((x) => x.id === "sealbreaker");
      expect(t?.description).toContain("2 Armageddon seals.");
    });

    it("Apocalypse Bringer at 3+ seals", () => {
      const titles = derivePlayerTitles(basePlayer({ armageddonSealsBroken: 3 }));
      const t = titles.find((x) => x.id === "sealbreaker");
      expect(t?.label).toBe("Apocalypse Bringer");
    });
  });

  describe("hero commander", () => {
    it("Hero Commander at 1 hero (singular phrasing)", () => {
      const titles = derivePlayerTitles(basePlayer({ heroCount: 1 }));
      const t = titles.find((x) => x.id === "hero-commander");
      expect(t?.label).toBe("Hero Commander");
      expect(t?.description).toContain("1 hero.");
    });

    it("Hero Commander plural at 2-4", () => {
      const titles = derivePlayerTitles(basePlayer({ heroCount: 2 }));
      const t = titles.find((x) => x.id === "hero-commander");
      expect(t?.description).toContain("2 heroes.");
    });

    it("Hero Marshal at 5+", () => {
      const titles = derivePlayerTitles(basePlayer({ heroCount: 5 }));
      const t = titles.find((x) => x.id === "hero-commander");
      expect(t?.label).toBe("Hero Marshal");
    });
  });

  describe("renegade", () => {
    it("awarded when casteChangesUsed ≥ 1", () => {
      const titles = derivePlayerTitles(basePlayer({ casteChangesUsed: 1 }));
      expect(titles.map((t) => t.id)).toContain("renegade");
    });

    it("not awarded when casteChangesUsed = 0", () => {
      const titles = derivePlayerTitles(basePlayer({ casteChangesUsed: 0 }));
      expect(titles.map((t) => t.id)).not.toContain("renegade");
    });
  });

  describe("seer / oracle", () => {
    it("Seer at 1 fulfilled prophecy", () => {
      const titles = derivePlayerTitles(basePlayer({ prophecyFulfilledCount: 1 }));
      const t = titles.find((x) => x.id === "seer");
      expect(t?.label).toBe("Seer");
    });

    it("Oracle at 3+ fulfilled prophecies", () => {
      const titles = derivePlayerTitles(basePlayer({ prophecyFulfilledCount: 3 }));
      const t = titles.find((x) => x.id === "seer");
      expect(t?.label).toBe("Oracle");
    });
  });

  describe("multi-title", () => {
    it("composes multiple titles for a high-achievement player", () => {
      const titles = derivePlayerTitles(
        basePlayer({
          stats: { tilesHeld: 1500, attacksWon: 600 } as unknown as GamePlayer["stats"],
          turnsSpentTotal: 12_000,
          armageddonSealsBroken: 4,
          heroCount: 6,
          casteChangesUsed: 1,
          prophecyFulfilledCount: 3,
        })
      );
      const ids = titles.map((t) => t.id);
      expect(ids).toContain("tile-baron-1k");
      expect(ids).toContain("warlord-500");
      expect(ids).toContain("veteran-10k");
      expect(ids).toContain("sealbreaker");
      expect(ids).toContain("hero-commander");
      expect(ids).toContain("renegade");
      expect(ids).toContain("seer");
    });
  });
});
