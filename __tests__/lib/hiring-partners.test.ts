/**
 * @jest-environment node
 */
import {
  HIRING_PARTNERS_CALENDLY_URL,
  HIRING_PARTNERS_COLLECTION,
  HIRING_PARTNERS_MAX,
  HIRING_PARTNERS_NOTIFY_EMAIL,
  HIRING_PARTNERS_RETURN_TO,
  PARTNER_ENGINEER_EXPECTATION_ITEMS,
  sanitizeEngineerExpectations,
} from "@/lib/hiring-partners";

describe("lib/hiring-partners", () => {
  describe("constants", () => {
    it("HIRING_PARTNERS_COLLECTION names the Firestore collection", () => {
      expect(HIRING_PARTNERS_COLLECTION).toBe("hiringPartnerApplications");
    });

    it("HIRING_PARTNERS_NOTIFY_EMAIL is a non-empty array of strings", () => {
      expect(Array.isArray(HIRING_PARTNERS_NOTIFY_EMAIL)).toBe(true);
      expect(HIRING_PARTNERS_NOTIFY_EMAIL.length).toBeGreaterThan(0);
      for (const e of HIRING_PARTNERS_NOTIFY_EMAIL) {
        expect(typeof e).toBe("string");
        expect(e).toMatch(/@/);
      }
    });

    it("HIRING_PARTNERS_CALENDLY_URL is an https calendly URL", () => {
      expect(HIRING_PARTNERS_CALENDLY_URL).toMatch(/^https:\/\/calendly\.com\//);
    });

    it("HIRING_PARTNERS_RETURN_TO is a site-relative path", () => {
      expect(HIRING_PARTNERS_RETURN_TO.startsWith("/")).toBe(true);
    });

    it("HIRING_PARTNERS_MAX exposes positive length caps for each input", () => {
      for (const [, v] of Object.entries(HIRING_PARTNERS_MAX)) {
        expect(typeof v).toBe("number");
        expect(v).toBeGreaterThan(0);
      }
    });

    it("PARTNER_ENGINEER_EXPECTATION_ITEMS has unique keys + non-empty labels", () => {
      const keys = PARTNER_ENGINEER_EXPECTATION_ITEMS.map((i) => i.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const item of PARTNER_ENGINEER_EXPECTATION_ITEMS) {
        expect(typeof item.label).toBe("string");
        expect(item.label.length).toBeGreaterThan(0);
      }
    });
  });

  describe("sanitizeEngineerExpectations", () => {
    it("returns an empty map for null", () => {
      expect(sanitizeEngineerExpectations(null)).toEqual({});
    });

    it("returns an empty map for undefined", () => {
      expect(sanitizeEngineerExpectations(undefined)).toEqual({});
    });

    it("returns an empty map for a string", () => {
      expect(sanitizeEngineerExpectations("not-an-object")).toEqual({});
    });

    it("returns an empty map for a number", () => {
      expect(sanitizeEngineerExpectations(42)).toEqual({});
    });

    it("returns an empty map for an empty object", () => {
      expect(sanitizeEngineerExpectations({})).toEqual({});
    });

    it("keeps every valid key in the expected 1..7 range", () => {
      const all = Object.fromEntries(
        PARTNER_ENGINEER_EXPECTATION_ITEMS.map((i, idx) => [
          i.key,
          ((idx % 7) + 1) as number,
        ]),
      );
      const out = sanitizeEngineerExpectations(all);
      expect(Object.keys(out).sort()).toEqual(
        PARTNER_ENGINEER_EXPECTATION_ITEMS.map((i) => i.key).sort(),
      );
    });

    it("drops keys not in the known set", () => {
      const out = sanitizeEngineerExpectations({
        yearsExperience: 5,
        notARealKey: 3,
        anotherBogus: 7,
      });
      expect(out).toEqual({ yearsExperience: 5 });
    });

    it("drops non-number values (string, boolean, null, object)", () => {
      const out = sanitizeEngineerExpectations({
        yearsExperience: "5",
        csFundamentals: true,
        systemDesign: null,
        aiToolFluency: {},
      });
      expect(out).toEqual({});
    });

    it("drops non-finite numbers (NaN, Infinity, -Infinity)", () => {
      const out = sanitizeEngineerExpectations({
        yearsExperience: NaN,
        csFundamentals: Infinity,
        systemDesign: -Infinity,
      });
      expect(out).toEqual({});
    });

    it("drops out-of-range values (0 and 8)", () => {
      const out = sanitizeEngineerExpectations({
        yearsExperience: 0,
        csFundamentals: 8,
        systemDesign: -3,
        aiToolFluency: 100,
      });
      expect(out).toEqual({});
    });

    it("rounds non-integer values into integers within range", () => {
      const out = sanitizeEngineerExpectations({
        yearsExperience: 3.4, // rounds to 3
        csFundamentals: 4.7, // rounds to 5
        systemDesign: 6.5, // rounds to 7
      });
      expect(out).toEqual({ yearsExperience: 3, csFundamentals: 5, systemDesign: 7 });
    });

    it("accepts the boundary values 1 and 7", () => {
      const out = sanitizeEngineerExpectations({
        yearsExperience: 1,
        csFundamentals: 7,
      });
      expect(out).toEqual({ yearsExperience: 1, csFundamentals: 7 });
    });

    it("rounds a value that would round to 0 (e.g. 0.4) and drops it as out-of-range", () => {
      const out = sanitizeEngineerExpectations({ yearsExperience: 0.4 });
      expect(out).toEqual({});
    });

    it("rounds a value that would round to 8 (e.g. 7.6) and drops it as out-of-range", () => {
      const out = sanitizeEngineerExpectations({ yearsExperience: 7.6 });
      expect(out).toEqual({});
    });

    it("ignores arrays (typeof object) at the top level by simply iterating their string indices", () => {
      // arrays *are* objects, but their entries are indexed strings — none of
      // the indexes (0, 1, ...) match a known key, so the result is empty.
      const out = sanitizeEngineerExpectations([5, 6, 7]);
      expect(out).toEqual({});
    });
  });
});
