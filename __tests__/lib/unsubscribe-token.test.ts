/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

type UnsubscribeTokenModule = typeof import("@/lib/unsubscribe-token");

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const UNIT_TEST_SECRET = "u".repeat(32);
const OTHER_TEST_SECRET = "o".repeat(32);

function setNodeEnv(value: string | undefined): void {
  if (value === undefined) {
    delete process.env.NODE_ENV;
    return;
  }

  Object.defineProperty(process.env, "NODE_ENV", {
    value,
    configurable: true,
  });
}

function loadTokenModule({
  env = {},
  nodeEnv = "test",
}: {
  env?: NodeJS.ProcessEnv;
  nodeEnv?: string;
} = {}): UnsubscribeTokenModule {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.UNSUBSCRIBE_SECRET;
  delete process.env.NEXTAUTH_SECRET;
  Object.assign(process.env, env);
  setNodeEnv(nodeEnv);

  return require("@/lib/unsubscribe-token") as UnsubscribeTokenModule;
}

afterEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
  setNodeEnv(ORIGINAL_NODE_ENV);
});

describe("unsubscribe token secret resolution", () => {
  it("fails closed outside development and test when no token secret is configured", () => {
    expect(() =>
      loadTokenModule({
        nodeEnv: "production",
      })
    ).toThrow(
      "UNSUBSCRIBE_SECRET must be configured; refusing to generate unsubscribe or withdraw tokens with a public fallback secret."
    );
  });

  it("fails closed for staging-like server environments without a token secret", () => {
    expect(() =>
      loadTokenModule({
        nodeEnv: "staging",
      })
    ).toThrow("UNSUBSCRIBE_SECRET must be configured");
  });

  it("ignores NEXTAUTH_SECRET for this token concern", () => {
    expect(() =>
      loadTokenModule({
        env: { NEXTAUTH_SECRET: UNIT_TEST_SECRET },
        nodeEnv: "production",
      })
    ).toThrow("UNSUBSCRIBE_SECRET must be configured");
  });

  it("rejects configured secrets shorter than 32 bytes", () => {
    expect(() =>
      loadTokenModule({
        env: { UNSUBSCRIBE_SECRET: "short-secret" },
        nodeEnv: "production",
      })
    ).toThrow("UNSUBSCRIBE_SECRET must be at least 32 bytes");
  });

  it("uses a 32-byte UNSUBSCRIBE_SECRET in production", () => {
    const withLongSecret = loadTokenModule({
      env: { UNSUBSCRIBE_SECRET: UNIT_TEST_SECRET },
      nodeEnv: "production",
    });
    const token = withLongSecret.generateUnsubscribeToken("user@example.com");

    const withExplicitSecret = loadTokenModule({
      env: { UNSUBSCRIBE_SECRET: UNIT_TEST_SECRET },
      nodeEnv: "production",
    });
    expect(withExplicitSecret.generateUnsubscribeToken("user@example.com")).toBe(
      token
    );
  });

  it("allows a deterministic dev/test fallback only outside server production", () => {
    const inDevelopment = loadTokenModule({
      nodeEnv: "development",
    });
    expect(inDevelopment.generateUnsubscribeToken("user@example.com")).toMatch(
      /^[a-f0-9]{64}$/
    );
  });
});

describe("generateUnsubscribeToken", () => {
  function tokens(): UnsubscribeTokenModule {
    return loadTokenModule({
      env: { UNSUBSCRIBE_SECRET: UNIT_TEST_SECRET },
    });
  }

  it("returns a hex string", () => {
    const token = tokens().generateUnsubscribeToken("user@example.com");
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic for the same email", () => {
    const { generateUnsubscribeToken } = tokens();
    const t1 = generateUnsubscribeToken("user@example.com");
    const t2 = generateUnsubscribeToken("user@example.com");
    expect(t1).toBe(t2);
  });

  it("normalizes email to lowercase and trimmed", () => {
    const { generateUnsubscribeToken } = tokens();
    const t1 = generateUnsubscribeToken("User@Example.COM");
    const t2 = generateUnsubscribeToken("  user@example.com  ");
    expect(t1).toBe(t2);
  });

  it("produces different tokens for different emails", () => {
    const { generateUnsubscribeToken } = tokens();
    const t1 = generateUnsubscribeToken("a@example.com");
    const t2 = generateUnsubscribeToken("b@example.com");
    expect(t1).not.toBe(t2);
  });
});

describe("verifyUnsubscribeToken", () => {
  function tokens(): UnsubscribeTokenModule {
    return loadTokenModule({
      env: { UNSUBSCRIBE_SECRET: UNIT_TEST_SECRET },
    });
  }

  it("returns true for a valid token", () => {
    const { generateUnsubscribeToken, verifyUnsubscribeToken } = tokens();
    const token = generateUnsubscribeToken("user@example.com");
    expect(verifyUnsubscribeToken("user@example.com", token)).toBe(true);
  });

  it("returns false for an invalid token", () => {
    const { verifyUnsubscribeToken } = tokens();
    expect(verifyUnsubscribeToken("user@example.com", "badtoken")).toBe(false);
  });

  it("returns false for an invalid token with the expected length", () => {
    const { verifyUnsubscribeToken } = tokens();
    expect(verifyUnsubscribeToken("user@example.com", "0".repeat(64))).toBe(
      false
    );
  });

  it("returns false for a non-hex token with the expected length", () => {
    const { verifyUnsubscribeToken } = tokens();
    expect(verifyUnsubscribeToken("user@example.com", "z".repeat(64))).toBe(
      false
    );
  });

  it("returns false for wrong email", () => {
    const { generateUnsubscribeToken, verifyUnsubscribeToken } = tokens();
    const token = generateUnsubscribeToken("user@example.com");
    expect(verifyUnsubscribeToken("other@example.com", token)).toBe(false);
  });
});

describe("buildUnsubscribeUrl", () => {
  function tokens(): UnsubscribeTokenModule {
    return loadTokenModule({
      env: { UNSUBSCRIBE_SECRET: UNIT_TEST_SECRET },
    });
  }

  it("contains the email and token as query params", () => {
    const url = tokens().buildUnsubscribeUrl("user@example.com");
    expect(url).toContain("/api/notifications/unsubscribe");
    expect(url).toContain("email=user%40example.com");
    expect(url).toContain("token=");
  });

  it("uses the correct token for the email", () => {
    const { buildUnsubscribeUrl, generateUnsubscribeToken } = tokens();
    const url = buildUnsubscribeUrl("user@example.com");
    const token = generateUnsubscribeToken("user@example.com");
    expect(url).toContain(`token=${token}`);
  });

  it("changes token output when the configured secret changes", () => {
    const first = loadTokenModule({
      env: { UNSUBSCRIBE_SECRET: UNIT_TEST_SECRET },
    }).generateUnsubscribeToken("user@example.com");
    const second = loadTokenModule({
      env: { UNSUBSCRIBE_SECRET: OTHER_TEST_SECRET },
    }).generateUnsubscribeToken("user@example.com");

    expect(first).not.toBe(second);
  });
});
