/**
 * @jest-environment node
 */

/**
 * Property-based coverage (fast-check) for the input sanitizers.
 *
 * Invariants under test (issue #1420) — real output guarantees, not just
 * "does not throw":
 *  - sanitizeText: strips the control characters it names, normalizes
 *    tabs/CRs to spaces, trims, and is idempotent.
 *  - sanitizeName: output only ever contains the allowed character class,
 *    with no doubled whitespace, and is idempotent.
 *  - sanitizeUrl: output is null or an http(s) URL in normalized form —
 *    normalization is a fixed point.
 *  - sanitizeDocId: output is null or a ≤1500-char [A-Za-z0-9_-]+ string
 *    accepted unchanged when fed back in.
 *  - isValidHackathonId: total over arbitrary strings.
 */

import fc from "fast-check";
import {
  sanitizeText,
  sanitizeName,
  sanitizeUrl,
  sanitizeDocId,
  isValidHackathonId,
} from "@/lib/sanitize";

// Arbitrary unicode strings, biased toward the characters the sanitizers act on.
const noisyString = fc.oneof(
  fc.string({ unit: "binary", maxLength: 300 }),
  fc.stringMatching(/^[\x00-\x1f\x7f a-zA-Z0-9<>&"'._\-\t\r\n]{0,300}$/)
);

describe("sanitizeText properties", () => {
  it("never leaves stripped control characters, tabs, or CRs in the output", () => {
    fc.assert(
      fc.property(noisyString, (input) => {
        const output = sanitizeText(input);
        expect(output).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\t\r]/);
      })
    );
  });

  it("always trims surrounding whitespace", () => {
    fc.assert(
      fc.property(noisyString, (input) => {
        const output = sanitizeText(input);
        expect(output).toBe(output.trim());
      })
    );
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(noisyString, (input) => {
        const once = sanitizeText(input);
        expect(sanitizeText(once)).toBe(once);
      })
    );
  });
});

describe("sanitizeName properties", () => {
  it("only ever emits the documented character class, single-spaced and trimmed", () => {
    fc.assert(
      fc.property(noisyString, (input) => {
        const output = sanitizeName(input);
        expect(output).toMatch(/^$|^[a-zA-Z0-9\-_.]+( [a-zA-Z0-9\-_.]+)*$/);
      })
    );
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(noisyString, (input) => {
        const once = sanitizeName(input);
        expect(sanitizeName(once)).toBe(once);
      })
    );
  });
});

describe("sanitizeUrl properties", () => {
  const urlish = fc.oneof(
    noisyString,
    fc.webUrl(),
    fc
      .tuple(
        fc.constantFrom("http", "https", "javascript", "data", "ftp", "file"),
        fc.string({ maxLength: 50 })
      )
      .map(([scheme, rest]) => `${scheme}:${rest}`)
  );

  it("returns null or a parseable http(s) URL", () => {
    fc.assert(
      fc.property(urlish, (input) => {
        const output = sanitizeUrl(input);
        if (output === null) return;
        const parsed = new URL(output);
        expect(["http:", "https:"]).toContain(parsed.protocol);
      })
    );
  });

  it("normalized output is a fixed point", () => {
    fc.assert(
      fc.property(urlish, (input) => {
        const output = sanitizeUrl(input);
        fc.pre(output !== null);
        expect(sanitizeUrl(output as string)).toBe(output);
      })
    );
  });
});

describe("sanitizeDocId properties", () => {
  it("returns null or a bounded id in the documented character class", () => {
    fc.assert(
      fc.property(noisyString, (input) => {
        const output = sanitizeDocId(input);
        if (output === null) return;
        expect(output).toMatch(/^[a-zA-Z0-9_-]+$/);
        expect(output.length).toBeLessThanOrEqual(1500);
      })
    );
  });

  it("accepts its own output unchanged", () => {
    fc.assert(
      fc.property(noisyString, (input) => {
        const output = sanitizeDocId(input);
        fc.pre(output !== null);
        expect(sanitizeDocId(output as string)).toBe(output);
      })
    );
  });

  it("rejects every string longer than 1500 characters after trimming", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1501, maxLength: 1600, unit: fc.constantFrom("a", "B", "3", "-", "_") }),
        (input) => {
          expect(sanitizeDocId(input)).toBeNull();
        }
      )
    );
  });
});

describe("isValidHackathonId properties", () => {
  it("is total over arbitrary strings and returns a boolean", () => {
    fc.assert(
      fc.property(noisyString, (input) => {
        expect(typeof isValidHackathonId(input)).toBe("boolean");
      })
    );
  });

  it("accepts every well-formed virtual-YYYY-MM id", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999 }),
        fc.integer({ min: 0, max: 99 }),
        (year, month) => {
          const id = `virtual-${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
          expect(isValidHackathonId(id)).toBe(true);
        }
      )
    );
  });
});
