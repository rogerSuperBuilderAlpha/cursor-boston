/**
 * @jest-environment node
 */
import {
  TREASURE_HUNT_PATHS,
  getKonamiToken,
  getOracleAnswer,
  getPath,
  listPaths,
} from "@/lib/treasure-hunt-paths";

const CTX = { uid: "u1", email: "u1@example.com" };

describe("treasure-hunt-paths", () => {
  describe("TREASURE_HUNT_PATHS registry", () => {
    it("exposes the expected 7 paths", () => {
      const expected = [
        "code-reader",
        "konami",
        "oracle",
        "librarian",
        "badge-collector",
        "cartographer",
        "cookbook-alchemist",
      ];
      expect(Object.keys(TREASURE_HUNT_PATHS).sort()).toEqual(expected.sort());
    });

    it("every path has the required fields", () => {
      for (const path of Object.values(TREASURE_HUNT_PATHS)) {
        expect(path.id).toBeTruthy();
        expect(path.name).toBeTruthy();
        expect(path.emoji).toBeTruthy();
        expect(path.hint).toBeTruthy();
        expect(typeof path.verify).toBe("function");
      }
    });
  });

  describe("listPaths", () => {
    it("returns all paths from the registry", () => {
      expect(listPaths()).toHaveLength(Object.keys(TREASURE_HUNT_PATHS).length);
    });
  });

  describe("getPath", () => {
    it("returns a path by id", () => {
      expect(getPath("code-reader")?.id).toBe("code-reader");
    });

    it("returns null for unknown ids", () => {
      expect(getPath("does-not-exist")).toBeNull();
    });
  });

  describe("code-reader path", () => {
    it("accepts the canonical answer (case-insensitive, whitespace-tolerant)", async () => {
      const p = TREASURE_HUNT_PATHS["code-reader"];
      expect(await p.verify("resolve_hack_a_sprint_2026_credit_for_user", CTX)).toBe(true);
      expect(await p.verify("  Resolve_Hack_A_Sprint_2026_Credit_For_User  ", CTX)).toBe(true);
    });

    it("rejects an incorrect answer", async () => {
      const p = TREASURE_HUNT_PATHS["code-reader"];
      expect(await p.verify("wrong", CTX)).toBe(false);
    });
  });

  describe("konami path + getKonamiToken", () => {
    it("returns a 12-character hex token", () => {
      expect(getKonamiToken()).toMatch(/^[0-9a-f]{12}$/);
    });

    it("verifies a freshly-minted token", async () => {
      const token = getKonamiToken();
      const p = TREASURE_HUNT_PATHS["konami"];
      expect(await p.verify(token, CTX)).toBe(true);
    });

    it("rejects an unrelated string", async () => {
      const p = TREASURE_HUNT_PATHS["konami"];
      expect(await p.verify("abc123abc123", CTX)).toBe(false);
    });
  });

  describe("oracle path + getOracleAnswer", () => {
    it("returns a 64-character hex digest", () => {
      expect(getOracleAnswer()).toMatch(/^[0-9a-f]{64}$/);
    });

    it("verifies the freshly-computed oracle answer", async () => {
      const answer = getOracleAnswer();
      const p = TREASURE_HUNT_PATHS["oracle"];
      expect(await p.verify(answer, CTX)).toBe(true);
    });
  });

  describe("env-driven paths use defaults when env is unset", () => {
    const originalSlug = process.env.TREASURE_HUNT_LIBRARIAN_SLUG;
    const originalBadge = process.env.TREASURE_HUNT_BADGE_ANSWER;
    const originalGeohash = process.env.TREASURE_HUNT_CARTOGRAPHER_GEOHASH;
    const originalCookbook = process.env.TREASURE_HUNT_COOKBOOK_ANSWER;

    afterAll(() => {
      const restore = (k: string, v: string | undefined) => {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      };
      restore("TREASURE_HUNT_LIBRARIAN_SLUG", originalSlug);
      restore("TREASURE_HUNT_BADGE_ANSWER", originalBadge);
      restore("TREASURE_HUNT_CARTOGRAPHER_GEOHASH", originalGeohash);
      restore("TREASURE_HUNT_COOKBOOK_ANSWER", originalCookbook);
    });

    it("librarian falls back to 'open-sesame' default", async () => {
      delete process.env.TREASURE_HUNT_LIBRARIAN_SLUG;
      expect(await TREASURE_HUNT_PATHS["librarian"].verify("open-sesame", CTX)).toBe(true);
    });

    it("librarian uses env override when set", async () => {
      process.env.TREASURE_HUNT_LIBRARIAN_SLUG = "custom-slug";
      expect(await TREASURE_HUNT_PATHS["librarian"].verify("custom-slug", CTX)).toBe(true);
      expect(await TREASURE_HUNT_PATHS["librarian"].verify("open-sesame", CTX)).toBe(false);
    });

    it("badge-collector falls back to default phrase", async () => {
      delete process.env.TREASURE_HUNT_BADGE_ANSWER;
      expect(
        await TREASURE_HUNT_PATHS["badge-collector"].verify(
          "firstprshowcasewinnermaintainer",
          CTX
        )
      ).toBe(true);
    });

    it("cartographer falls back to default geohash", async () => {
      delete process.env.TREASURE_HUNT_CARTOGRAPHER_GEOHASH;
      expect(await TREASURE_HUNT_PATHS["cartographer"].verify("drt2zmw", CTX)).toBe(true);
    });

    it("cookbook-alchemist falls back to default phrase", async () => {
      delete process.env.TREASURE_HUNT_COOKBOOK_ANSWER;
      expect(
        await TREASURE_HUNT_PATHS["cookbook-alchemist"].verify("promptcachinglovesyou", CTX)
      ).toBe(true);
    });
  });

  describe("answer normalization is timing-safe", () => {
    it("rejects answers of different length without leaking via timing", async () => {
      // Behavioral assertion: short and long incorrect answers both return false.
      const p = TREASURE_HUNT_PATHS["code-reader"];
      expect(await p.verify("", CTX)).toBe(false);
      expect(await p.verify("a", CTX)).toBe(false);
      expect(await p.verify("a".repeat(1000), CTX)).toBe(false);
    });
  });
});
