/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/pydata-withdraw/page.tsx` (0% / 19
 * uncovered branches). Server-rendered confirmation page; covers each
 * status-string branch (success/invalid/rate-limited/error) plus the
 * default confirmation render, the token-verify gate (missing email,
 * missing token, bad signature, good signature), and the maskEmail
 * branches (short local, normal local).
 */

import "@/__tests__/app/_shared/page-test-setup";
import React from "react";
import { render } from "@testing-library/react";

const mockVerify = jest.fn();

jest.mock("@/lib/unsubscribe-token", () => ({
  verifyPydataWithdrawToken: (...args: unknown[]) => mockVerify(...args),
}));

import PydataWithdrawPage from "@/app/pydata-withdraw/page";

async function renderPage(over: Partial<Record<string, string>> = {}) {
  const result = await PydataWithdrawPage({
    searchParams: Promise.resolve(over),
  });
  const { container } = render(result as React.ReactElement);
  return container.textContent ?? "";
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerify.mockReturnValue(true);
});

describe("PydataWithdrawPage", () => {
  it("renders the success page when status=success", async () => {
    const text = await renderPage({ status: "success" });
    expect(text).toMatch(/You've withdrawn from PyData/);
  });

  it("renders the invalid page when status=invalid", async () => {
    const text = await renderPage({ status: "invalid" });
    expect(text).toMatch(/Invalid link/);
  });

  it("renders the rate-limited page when status=rate-limited", async () => {
    const text = await renderPage({ status: "rate-limited" });
    expect(text).toMatch(/Too many requests/);
  });

  it("renders the error page when status=error", async () => {
    const text = await renderPage({ status: "error" });
    expect(text).toMatch(/Something went wrong/);
  });

  it("renders 'Invalid link' when email is missing", async () => {
    const text = await renderPage({ token: "tok" });
    expect(text).toMatch(/Invalid link/);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("renders 'Invalid link' when token is missing", async () => {
    const text = await renderPage({ email: "x@y.com" });
    expect(text).toMatch(/Invalid link/);
  });

  it("renders 'Invalid link' when verifyPydataWithdrawToken returns false", async () => {
    mockVerify.mockReturnValueOnce(false);
    const text = await renderPage({ email: "x@y.com", token: "bad" });
    expect(text).toMatch(/Invalid link/);
  });

  it("renders the confirmation form on valid signature (masked email)", async () => {
    const text = await renderPage({ email: "longuser@example.com", token: "valid" });
    expect(text).toMatch(/Withdraw from PyData May 13/);
    expect(text).toMatch(/lo\*\*\*r@example\.com/);
    expect(text).toMatch(/Yes, withdraw me/);
  });

  it("masks short local parts with single-char prefix", async () => {
    const text = await renderPage({ email: "abc@example.com", token: "valid" });
    expect(text).toMatch(/a\*\*\*@example\.com/);
  });

  it("trims and lowercases email before display + verify", async () => {
    await renderPage({ email: "  TestUser@Example.COM  ", token: "valid" });
    expect(mockVerify).toHaveBeenCalledWith("testuser@example.com", "valid");
  });
});
