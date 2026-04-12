/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  buildUnsubscribeUrl,
} from "@/lib/unsubscribe-token";

describe("generateUnsubscribeToken", () => {
  it("returns a hex string", () => {
    const token = generateUnsubscribeToken("user@example.com");
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic for the same email", () => {
    const t1 = generateUnsubscribeToken("user@example.com");
    const t2 = generateUnsubscribeToken("user@example.com");
    expect(t1).toBe(t2);
  });

  it("normalizes email to lowercase and trimmed", () => {
    const t1 = generateUnsubscribeToken("User@Example.COM");
    const t2 = generateUnsubscribeToken("  user@example.com  ");
    expect(t1).toBe(t2);
  });

  it("produces different tokens for different emails", () => {
    const t1 = generateUnsubscribeToken("a@example.com");
    const t2 = generateUnsubscribeToken("b@example.com");
    expect(t1).not.toBe(t2);
  });
});

describe("verifyUnsubscribeToken", () => {
  it("returns true for a valid token", () => {
    const token = generateUnsubscribeToken("user@example.com");
    expect(verifyUnsubscribeToken("user@example.com", token)).toBe(true);
  });

  it("returns false for an invalid token", () => {
    expect(verifyUnsubscribeToken("user@example.com", "badtoken")).toBe(false);
  });

  it("returns false for wrong email", () => {
    const token = generateUnsubscribeToken("user@example.com");
    expect(verifyUnsubscribeToken("other@example.com", token)).toBe(false);
  });
});

describe("buildUnsubscribeUrl", () => {
  it("contains the email and token as query params", () => {
    const url = buildUnsubscribeUrl("user@example.com");
    expect(url).toContain("/api/notifications/unsubscribe");
    expect(url).toContain("email=user%40example.com");
    expect(url).toContain("token=");
  });

  it("uses the correct token for the email", () => {
    const url = buildUnsubscribeUrl("user@example.com");
    const token = generateUnsubscribeToken("user@example.com");
    expect(url).toContain(`token=${token}`);
  });
});
