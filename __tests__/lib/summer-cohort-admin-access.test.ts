import {
  SUMMER_COHORT_ADMIN_EMAILS_ENV,
  getSummerCohortAdminEmailSet,
  isSummerCohortAdminEmail,
} from "@/lib/summer-cohort-admin-access";

describe("summer-cohort-admin-access", () => {
  const originalEnv = process.env[SUMMER_COHORT_ADMIN_EMAILS_ENV];

  afterEach(() => {
    if (originalEnv === undefined) delete process.env[SUMMER_COHORT_ADMIN_EMAILS_ENV];
    else process.env[SUMMER_COHORT_ADMIN_EMAILS_ENV] = originalEnv;
  });

  describe("getSummerCohortAdminEmailSet", () => {
    it("returns an empty set when the env var is unset", () => {
      delete process.env[SUMMER_COHORT_ADMIN_EMAILS_ENV];
      expect(getSummerCohortAdminEmailSet().size).toBe(0);
    });

    it("returns an empty set when the env var is an empty string", () => {
      process.env[SUMMER_COHORT_ADMIN_EMAILS_ENV] = "";
      expect(getSummerCohortAdminEmailSet().size).toBe(0);
    });

    it("parses a comma-separated list and lowercases each entry", () => {
      process.env[SUMMER_COHORT_ADMIN_EMAILS_ENV] = "Roger@Example.com,Brad@Example.com";
      const set = getSummerCohortAdminEmailSet();
      expect(set.has("roger@example.com")).toBe(true);
      expect(set.has("brad@example.com")).toBe(true);
      expect(set.size).toBe(2);
    });

    it("trims whitespace and skips empties", () => {
      process.env[SUMMER_COHORT_ADMIN_EMAILS_ENV] = " a@x.com , , b@x.com ,";
      const set = getSummerCohortAdminEmailSet();
      expect(set.size).toBe(2);
      expect(set.has("a@x.com")).toBe(true);
      expect(set.has("b@x.com")).toBe(true);
    });
  });

  describe("isSummerCohortAdminEmail", () => {
    beforeEach(() => {
      process.env[SUMMER_COHORT_ADMIN_EMAILS_ENV] = "roger@example.com,brad@example.com";
    });

    it("returns true for an allow-listed email (case-insensitive)", () => {
      expect(isSummerCohortAdminEmail("Roger@Example.com")).toBe(true);
      expect(isSummerCohortAdminEmail("brad@example.com")).toBe(true);
    });

    it("returns false for an email not on the list", () => {
      expect(isSummerCohortAdminEmail("stranger@example.com")).toBe(false);
    });

    it("returns false for null/undefined/empty inputs", () => {
      expect(isSummerCohortAdminEmail(null)).toBe(false);
      expect(isSummerCohortAdminEmail(undefined)).toBe(false);
      expect(isSummerCohortAdminEmail("")).toBe(false);
    });

    it("trims whitespace before comparison", () => {
      expect(isSummerCohortAdminEmail("  roger@example.com  ")).toBe(true);
    });
  });
});
