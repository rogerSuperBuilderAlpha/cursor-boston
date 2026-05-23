/**
 * @jest-environment node
 *
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { logEvent } from "firebase/analytics";
import {
  sanitizeAnalyticsProperties,
  trackEvent,
} from "@/lib/analytics";

jest.mock("firebase/analytics", () => ({
  logEvent: jest.fn(),
}));

jest.mock("@/lib/firebase", () => ({
  analyticsReady: Promise.resolve({ app: "analytics" }),
}));

const mockLogEvent = logEvent as jest.MockedFunction<typeof logEvent>;

describe("analytics event tracking", () => {
  const originalWindow = global.window;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(global, "window", {
      value: {},
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(global, "window", {
      value: originalWindow,
      configurable: true,
    });
  });

  it("filters PII-shaped keys and unsupported values before logging", () => {
    const properties = sanitizeAnalyticsProperties({
      area: "Analytics",
      cta: "open_issue",
      issue_number: 592,
      userId: "uid-123",
      email: "person@example.com",
      displayName: "Person",
      empty: null,
      unsupported: undefined,
      finite: Number.POSITIVE_INFINITY,
      enabled: true,
    });

    expect(properties).toEqual({
      area: "Analytics",
      cta: "open_issue",
      issue_number: 592,
      enabled: true,
    });
  });

  it("truncates long string properties", () => {
    const properties = sanitizeAnalyticsProperties({
      path: "x".repeat(150),
    });

    expect(properties.path).toHaveLength(120);
  });

  it("logs events when Firebase Analytics is available in the browser", async () => {
    await expect(
      trackEvent("sign_in_cta_click", {
        surface: "hackathon_signup",
        event_id: "sports-hack-2026",
      })
    ).resolves.toBe(true);

    expect(mockLogEvent).toHaveBeenCalledWith(
      { app: "analytics" },
      "sign_in_cta_click",
      {
        surface: "hackathon_signup",
        event_id: "sports-hack-2026",
      }
    );
  });

  it("does not log events during server-side execution", async () => {
    delete (global as typeof globalThis & { window?: unknown }).window;

    await expect(trackEvent("feature_banner_view")).resolves.toBe(false);

    expect(mockLogEvent).not.toHaveBeenCalled();
  });
});
