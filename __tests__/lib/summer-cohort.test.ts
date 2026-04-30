import {
  SUMMER_COHORTS,
  SUMMER_COHORT_COLLECTION,
  SUMMER_COHORT_DEMO_DAY,
  SUMMER_COHORT_IMMERSION,
  SUMMER_COHORT_LOCALSTORAGE_KEY,
  SUMMER_COHORT_MEETING_CADENCE,
  SUMMER_COHORT_NOTIFY_EMAIL,
  SUMMER_COHORT_OPEN_EVENT,
  SUMMER_COHORT_PHILOSOPHY,
  SUMMER_COHORT_RETURN_TO,
  SUMMER_COHORT_SITE_ID,
  SUMMER_COHORT_WEEKS,
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

describe("lib/summer-cohort program breakdown", () => {
  it("defines exactly 6 weekly themes", () => {
    expect(SUMMER_COHORT_WEEKS).toHaveLength(6);
  });

  it("numbers weeks 1..6 in order", () => {
    SUMMER_COHORT_WEEKS.forEach((w, i) => {
      expect(w.week).toBe(i + 1);
      expect(w.title.length).toBeGreaterThan(0);
      expect(w.description.length).toBeGreaterThan(0);
    });
  });

  it("awards a winner cert for weeks 1, 2, 3 only", () => {
    const certByWeek = new Map(
      SUMMER_COHORT_WEEKS.map((w) => [w.week, w.winnerCert] as const)
    );
    expect(certByWeek.get(1)).toBe("PM Winner");
    expect(certByWeek.get(2)).toBe("Comms Winner");
    expect(certByWeek.get(3)).toBe("Marketing Winner");
    expect(certByWeek.get(4)).toBeUndefined();
    expect(certByWeek.get(5)).toBeUndefined();
    expect(certByWeek.get(6)).toBeUndefined();
  });

  it("exposes meeting cadence, immersion, demo day, and philosophy strings", () => {
    expect(typeof SUMMER_COHORT_MEETING_CADENCE).toBe("string");
    expect(SUMMER_COHORT_MEETING_CADENCE.length).toBeGreaterThan(0);

    expect(SUMMER_COHORT_IMMERSION.date).toBe("2026-05-26");
    expect(SUMMER_COHORT_IMMERSION.label).toMatch(/May/);
    expect(SUMMER_COHORT_IMMERSION.title.length).toBeGreaterThan(0);
    expect(SUMMER_COHORT_IMMERSION.description.length).toBeGreaterThan(0);

    expect(SUMMER_COHORT_DEMO_DAY.title.length).toBeGreaterThan(0);
    expect(SUMMER_COHORT_DEMO_DAY.description).toMatch(/no placement guarantees/i);

    expect(SUMMER_COHORT_PHILOSOPHY).toMatch(/cohort/i);
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
