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
  // The secret is resolved lazily (on first token op), not at import time, so
  // the module loads cleanly and the fail-closed throw surfaces on first use.
  it("fails closed outside development and test when no token secret is configured", () => {
    const mod = loadTokenModule({ nodeEnv: "production" });
    expect(() => mod.generateUnsubscribeToken("user@example.com")).toThrow(
      "UNSUBSCRIBE_SECRET must be configured; refusing to generate unsubscribe or withdraw tokens with a public fallback secret."
    );
  });

  it("fails closed for staging-like server environments without a token secret", () => {
    const mod = loadTokenModule({ nodeEnv: "staging" });
    expect(() => mod.generateUnsubscribeToken("user@example.com")).toThrow(
      "UNSUBSCRIBE_SECRET must be configured"
    );
  });

  it("ignores NEXTAUTH_SECRET for this token concern", () => {
    const mod = loadTokenModule({
      env: { NEXTAUTH_SECRET: UNIT_TEST_SECRET },
      nodeEnv: "production",
    });
    expect(() => mod.generateUnsubscribeToken("user@example.com")).toThrow(
      "UNSUBSCRIBE_SECRET must be configured"
    );
  });

  it("rejects configured secrets shorter than 32 bytes", () => {
    const mod = loadTokenModule({
      env: { UNSUBSCRIBE_SECRET: "short-secret" },
      nodeEnv: "production",
    });
    expect(() => mod.generateUnsubscribeToken("user@example.com")).toThrow(
      "UNSUBSCRIBE_SECRET must be at least 32 bytes"
    );
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

  it("resolves the secret lazily — env set AFTER import is still honored", () => {
    // Reproduces the real-world script ordering: the module is imported first
    // (imports are hoisted), and UNSUBSCRIBE_SECRET is populated afterwards
    // (e.g. by loadEnvConfig). Lazy resolution must pick it up, not throw.
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.UNSUBSCRIBE_SECRET;
    setNodeEnv("production");
    const mod = require("@/lib/unsubscribe-token") as UnsubscribeTokenModule;
    // Env arrives only now, after the module is already loaded.
    process.env.UNSUBSCRIBE_SECRET = UNIT_TEST_SECRET;
    expect(mod.generateUnsubscribeToken("user@example.com")).toMatch(
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

  it("accepts a token signed with the quote-wrapped secret (early-June 2026 blast compat)", () => {
    // The cohort-1 Discord blast and the 2026-06-03 game digest signed links
    // with the secret value including its surrounding double-quotes, because
    // the send command extracted it from .env.local with `cut` (quotes kept).
    // Those already-sent links must still verify.
    const { verifyUnsubscribeToken } = tokens();
    const { createHmac } = require("crypto") as typeof import("crypto");
    const legacyToken = createHmac("sha256", `"${UNIT_TEST_SECRET}"`)
      .update("user@example.com")
      .digest("hex");
    expect(verifyUnsubscribeToken("user@example.com", legacyToken)).toBe(true);
  });

  it("does not accept a quoted-secret token for the wrong email", () => {
    const { verifyUnsubscribeToken } = tokens();
    const { createHmac } = require("crypto") as typeof import("crypto");
    const legacyToken = createHmac("sha256", `"${UNIT_TEST_SECRET}"`)
      .update("user@example.com")
      .digest("hex");
    expect(verifyUnsubscribeToken("other@example.com", legacyToken)).toBe(false);
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
