/**
 * @jest-environment node
 */

/**
 * Property-based coverage (fast-check) for verifyWebhookSignature.
 *
 * Invariants under test (issue #1420):
 *  - No throwing: arbitrary signature input — any unicode string, any
 *    length — returns a boolean; malformed input is an unauthorized
 *    result, never a server error path.
 *  - Soundness: the only accepted signature for a payload is the exact
 *    "sha256=" + HMAC-SHA256 hex digest under the configured secret.
 *  - Completeness: the correct digest is always accepted.
 *
 * The module caches GITHUB_WEBHOOK_SECRET at import time, so the env var
 * is set first and the module is loaded via jest.isolateModules.
 */

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/github-recent-merged-prs", () => ({
  getGithubRepoPair: () => ({ owner: "test-owner", repo: "test-repo" }),
}));

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "SERVER_TS",
    increment: (n: number) => `INCREMENT(${n})`,
  },
}));

import fc from "fast-check";
import { createHmac } from "crypto";

const SECRET = "property-test-webhook-secret";

function expectedSignature(payload: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(payload).digest("hex");
}

let verifyWebhookSignature: (
  payload: string,
  signature: string | null
) => boolean;

beforeAll(() => {
  process.env.GITHUB_WEBHOOK_SECRET = SECRET;
  jest.isolateModules(() => {
    ({ verifyWebhookSignature } = require("@/lib/github"));
  });
});

afterAll(() => {
  delete process.env.GITHUB_WEBHOOK_SECRET;
});

describe("verifyWebhookSignature properties", () => {
  it("returns a boolean and never throws for arbitrary payload/signature pairs", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string({ unit: "binary", maxLength: 200 }),
        (payload, signature) => {
          const result = verifyWebhookSignature(payload, signature);
          expect(typeof result).toBe("boolean");
        }
      )
    );
  });

  it("rejects every signature that is not the exact expected digest", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string({ unit: "binary", maxLength: 200 }),
        (payload, signature) => {
          fc.pre(signature !== expectedSignature(payload));
          expect(verifyWebhookSignature(payload, signature)).toBe(false);
        }
      )
    );
  });

  it("accepts the correct digest for any payload", () => {
    fc.assert(
      fc.property(fc.string(), (payload) => {
        expect(verifyWebhookSignature(payload, expectedSignature(payload))).toBe(
          true
        );
      })
    );
  });

  it("rejects any single-character corruption of the correct signature", () => {
    const hexChars = "0123456789abcdef";
    fc.assert(
      fc.property(
        fc.string(),
        // Position within the 64-char hex digest (after the "sha256=" prefix).
        fc.nat({ max: 63 }),
        fc.nat({ max: 15 }),
        (payload, digestIndex, replacementIndex) => {
          const valid = expectedSignature(payload);
          const index = "sha256=".length + digestIndex;
          const replacement = hexChars[replacementIndex];
          fc.pre(valid[index] !== replacement);
          const corrupted =
            valid.slice(0, index) + replacement + valid.slice(index + 1);
          expect(verifyWebhookSignature(payload, corrupted)).toBe(false);
        }
      )
    );
  });

  it("rejects every truncation or extension of the correct signature without throwing", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer({ min: -70, max: 70 }),
        (payload, delta) => {
          fc.pre(delta !== 0);
          const valid = expectedSignature(payload);
          const malformed =
            delta < 0 ? valid.slice(0, delta) : valid + "0".repeat(delta);
          expect(verifyWebhookSignature(payload, malformed)).toBe(false);
        }
      )
    );
  });
});
