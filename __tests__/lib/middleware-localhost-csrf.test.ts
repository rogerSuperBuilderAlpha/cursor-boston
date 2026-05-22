/**
 * @jest-environment node
 */

/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { isOriginAllowed } from "@/lib/middleware";

function setNodeEnv(value: string | undefined) {
  if (value === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = value;
  }
}

function makeRequest(opts: {
  origin?: string;
  referer?: string;
  url?: string;
}) {
  const headers: Record<string, string> = {};
  if (opts.origin !== undefined) headers.origin = opts.origin;
  if (opts.referer !== undefined) headers.referer = opts.referer;

  return new NextRequest(opts.url ?? "https://cursorboston.com/api/x", {
    method: "POST",
    headers,
  });
}

describe("isOriginAllowed localhost CSRF allowlist", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    setNodeEnv(originalNodeEnv);
  });

  it("rejects localhost origins outside development for cross-origin writes", () => {
    setNodeEnv("production");

    expect(
      isOriginAllowed(makeRequest({ origin: "http://localhost:3000" }))
    ).toBe(false);
  });

  it("allows localhost origins during development for cross-origin writes", () => {
    setNodeEnv("development");

    expect(
      isOriginAllowed(makeRequest({ origin: "http://localhost:3000" }))
    ).toBe(true);
  });

  it("rejects localhost referers outside development for cross-origin writes", () => {
    setNodeEnv("production");

    expect(
      isOriginAllowed(
        makeRequest({ referer: "http://localhost:3001/dashboard" })
      )
    ).toBe(false);
  });

  it("allows localhost referers during development for cross-origin writes", () => {
    setNodeEnv("development");

    expect(
      isOriginAllowed(
        makeRequest({ referer: "http://localhost:3001/dashboard" })
      )
    ).toBe(true);
  });
});
