import {
  SUMMER_COHORTS,
  SUMMER_COHORT_COLLECTION,
  SUMMER_COHORT_LOCALSTORAGE_KEY,
  SUMMER_COHORT_NOTIFY_EMAIL,
  SUMMER_COHORT_OPEN_EVENT,
  SUMMER_COHORT_RETURN_TO,
  SUMMER_COHORT_SITE_ID,
  isValidCohortId,
} from "@/lib/summer-cohort";

describe("lib/summer-cohort constants", () => {
  it("exposes the expected siteId", () => {
    expect(SUMMER_COHORT_SITE_ID).toBe("cursor-boston");
  });

  it("exposes a Firestore collection name", () => {
    expect(SUMMER_COHORT_COLLECTION).toBe("summerCohortApplications");
  });

  it("exposes the notify email", () => {
    expect(SUMMER_COHORT_NOTIFY_EMAIL).toMatch(/@/);
  });

  it("exposes the page path used as returnTo", () => {
    expect(SUMMER_COHORT_RETURN_TO).toBe("/summer-cohort");
  });

  it("exposes a custom event name and a localStorage key", () => {
    expect(typeof SUMMER_COHORT_OPEN_EVENT).toBe("string");
    expect(SUMMER_COHORT_OPEN_EVENT.length).toBeGreaterThan(0);
    expect(typeof SUMMER_COHORT_LOCALSTORAGE_KEY).toBe("string");
    expect(SUMMER_COHORT_LOCALSTORAGE_KEY.length).toBeGreaterThan(0);
  });

  it("defines exactly two cohorts with valid id/start/end strings", () => {
    expect(SUMMER_COHORTS).toHaveLength(2);
    for (const c of SUMMER_COHORTS) {
      expect(c.id).toMatch(/^cohort-[12]$/);
      expect(c.label).toMatch(/Cohort \d/);
      expect(c.start).toMatch(/^2026-\d{2}-\d{2}$/);
      expect(c.end).toMatch(/^2026-\d{2}-\d{2}$/);
      expect(c.startLabel.length).toBeGreaterThan(0);
      expect(c.endLabel.length).toBeGreaterThan(0);
    }
  });

  it("orders cohort 1 before cohort 2 by start date", () => {
    const [c1, c2] = SUMMER_COHORTS;
    expect(c1.id).toBe("cohort-1");
    expect(c2.id).toBe("cohort-2");
    expect(c1.start < c2.start).toBe(true);
  });
});

describe("lib/summer-cohort isValidCohortId", () => {
  it("accepts the two known ids", () => {
    expect(isValidCohortId("cohort-1")).toBe(true);
    expect(isValidCohortId("cohort-2")).toBe(true);
  });

  it("rejects unknown strings", () => {
    expect(isValidCohortId("cohort-3")).toBe(false);
    expect(isValidCohortId("Cohort-1")).toBe(false);
    expect(isValidCohortId("")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isValidCohortId(null)).toBe(false);
    expect(isValidCohortId(undefined)).toBe(false);
    expect(isValidCohortId(1)).toBe(false);
    expect(isValidCohortId({ id: "cohort-1" })).toBe(false);
    expect(isValidCohortId(["cohort-1"])).toBe(false);
  });
});
