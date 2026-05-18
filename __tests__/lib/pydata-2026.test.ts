/**
 * @jest-environment node
 */
import {
  PYDATA_2026_CAPACITY,
  PYDATA_2026_EVENT_ID,
  PYDATA_2026_EVENT_SLUG,
  PYDATA_2026_LIMITS,
  PYDATA_2026_LUMA_EVENT_NAME,
  PYDATA_2026_LUMA_URL,
  PYDATA_2026_REGISTRATION_OPEN,
  PYDATA_2026_REGISTRATION_PATH,
  PYDATA_2026_REGISTRATIONS_COLLECTION,
  validatePydataRegistration,
} from "@/lib/pydata-2026";

const VALID = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "+1 555 0100",
  organization: "Analytical",
  attendingConfirmed: true,
};

describe("lib/pydata-2026", () => {
  describe("constants", () => {
    it("PYDATA_2026_EVENT_ID and SLUG are the canonical strings", () => {
      expect(PYDATA_2026_EVENT_ID).toBe("cursor-boston-pydata-2026");
      expect(PYDATA_2026_EVENT_SLUG).toBe("cursor-boston-pydata-2026");
    });

    it("PYDATA_2026_LUMA_URL is the Luma event URL", () => {
      expect(PYDATA_2026_LUMA_URL).toMatch(/^https:\/\/luma\.com\//);
    });

    it("PYDATA_2026_REGISTRATION_PATH is derived from the slug", () => {
      expect(PYDATA_2026_REGISTRATION_PATH).toBe(
        "/events/cursor-boston-pydata-2026/register",
      );
    });

    it("PYDATA_2026_REGISTRATIONS_COLLECTION is the Firestore collection", () => {
      expect(PYDATA_2026_REGISTRATIONS_COLLECTION).toBe(
        "pydataHack2026Registrations",
      );
    });

    it("PYDATA_2026_REGISTRATION_OPEN is a boolean (closed by post-event)", () => {
      expect(typeof PYDATA_2026_REGISTRATION_OPEN).toBe("boolean");
    });

    it("PYDATA_2026_LUMA_EVENT_NAME matches Luma exactly", () => {
      expect(PYDATA_2026_LUMA_EVENT_NAME).toBe(
        "Cursor Boston-PyData Data Science Hack",
      );
    });

    it("PYDATA_2026_CAPACITY is the door cap (150)", () => {
      expect(PYDATA_2026_CAPACITY).toBe(150);
    });

    it("PYDATA_2026_LIMITS exposes positive caps + nameMin", () => {
      for (const [, v] of Object.entries(PYDATA_2026_LIMITS)) {
        expect(typeof v).toBe("number");
        expect(v).toBeGreaterThan(0);
      }
      expect(PYDATA_2026_LIMITS.nameMin).toBe(2);
    });
  });

  describe("validatePydataRegistration — happy path", () => {
    it("accepts a fully valid payload and returns the trimmed/lowercased data", () => {
      const out = validatePydataRegistration({
        ...VALID,
        firstName: "  Ada  ",
        email: "Ada@Example.COM",
      });
      expect(out.ok).toBe(true);
      if (out.ok) {
        expect(out.data).toEqual({
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
          phone: "+1 555 0100",
          organization: "Analytical",
          attendingConfirmed: true,
        });
      }
    });

    it("clamps oversized inputs to the documented max lengths", () => {
      const longFirst = "a".repeat(PYDATA_2026_LIMITS.firstName + 10);
      const longOrg = "z".repeat(PYDATA_2026_LIMITS.organization + 20);
      const out = validatePydataRegistration({
        ...VALID,
        firstName: longFirst,
        organization: longOrg,
      });
      expect(out.ok).toBe(true);
      if (out.ok) {
        expect(out.data.firstName.length).toBe(PYDATA_2026_LIMITS.firstName);
        expect(out.data.organization.length).toBe(PYDATA_2026_LIMITS.organization);
      }
    });
  });

  describe("validatePydataRegistration — rejection paths", () => {
    it("returns errors=[] when raw is not an object (string)", () => {
      const out = validatePydataRegistration("not-an-object");
      expect(out.ok).toBe(false);
      if (!out.ok) {
        // every field is empty → required errors fire
        expect(out.errors).toEqual(
          expect.arrayContaining([
            "firstName-required",
            "lastName-required",
            "email-required",
            "organization-required",
            "must-confirm-attendance",
          ]),
        );
      }
    });

    it("flags firstName-required when missing", () => {
      const out = validatePydataRegistration({ ...VALID, firstName: "" });
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.errors).toContain("firstName-required");
    });

    it("flags firstName-too-short for single-letter first name", () => {
      const out = validatePydataRegistration({ ...VALID, firstName: "A" });
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.errors).toContain("firstName-too-short");
    });

    it("flags lastName-required when missing", () => {
      const out = validatePydataRegistration({ ...VALID, lastName: "" });
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.errors).toContain("lastName-required");
    });

    it("flags lastName-too-short for single-letter last name", () => {
      const out = validatePydataRegistration({ ...VALID, lastName: "B" });
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.errors).toContain("lastName-too-short");
    });

    it("flags email-required when missing", () => {
      const out = validatePydataRegistration({ ...VALID, email: "" });
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.errors).toContain("email-required");
    });

    it("flags email-invalid on malformed input", () => {
      for (const bad of ["nope", "a@b", "a b@c.d", "@c.d", "no-at.com"]) {
        const out = validatePydataRegistration({ ...VALID, email: bad });
        expect(out.ok).toBe(false);
        if (!out.ok) expect(out.errors).toContain("email-invalid");
      }
    });

    it("flags organization-required when missing", () => {
      const out = validatePydataRegistration({ ...VALID, organization: "" });
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.errors).toContain("organization-required");
    });

    it("flags must-confirm-attendance when attendingConfirmed !== true", () => {
      for (const bad of [false, "true", 1, undefined]) {
        const out = validatePydataRegistration({
          ...VALID,
          attendingConfirmed: bad as unknown as true,
        });
        expect(out.ok).toBe(false);
        if (!out.ok) expect(out.errors).toContain("must-confirm-attendance");
      }
    });

    it("treats non-string fields as empty strings (clamp returns '')", () => {
      const out = validatePydataRegistration({
        firstName: 123,
        lastName: { x: 1 },
        email: null,
        phone: undefined,
        organization: [],
        attendingConfirmed: true,
      });
      expect(out.ok).toBe(false);
      if (!out.ok) {
        expect(out.errors).toEqual(
          expect.arrayContaining([
            "firstName-required",
            "lastName-required",
            "email-required",
            "organization-required",
          ]),
        );
      }
    });

    it("accumulates multiple errors in one pass", () => {
      const out = validatePydataRegistration({});
      expect(out.ok).toBe(false);
      if (!out.ok) {
        expect(new Set(out.errors)).toEqual(
          new Set([
            "firstName-required",
            "lastName-required",
            "email-required",
            "organization-required",
            "must-confirm-attendance",
          ]),
        );
      }
    });
  });
});
