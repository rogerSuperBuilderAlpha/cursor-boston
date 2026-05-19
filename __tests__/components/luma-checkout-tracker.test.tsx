/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `components/LumaCheckoutTracker.tsx` was at
 * 10.3% statements (40 uncovered). Covers every branch of the message
 * listener: origin validation (allow lu.ma, allow *.lu.ma, reject other,
 * reject bad URL), each accepted `type/event/action` payload variant,
 * eventId fallbacks, known/unknown EVENT_DATA, signed-out (no register),
 * registerForEvent throw caught by try/catch, click listener writes
 * sessionStorage intent.
 */

import React from "react";
import { act, render } from "@testing-library/react";

const mockRegisterForEvent = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/registrations", () => ({
  registerForEvent: (...args: unknown[]) => mockRegisterForEvent(...args),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from "@/contexts/AuthContext";
import LumaCheckoutTracker from "@/components/LumaCheckoutTracker";

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function setUser(user: unknown) {
  mockUseAuth.mockReturnValue({ user, userProfile: null, loading: false } as never);
}

function postMessage(origin: string, data: unknown) {
  act(() => {
    const event = new MessageEvent("message", { data, origin });
    window.dispatchEvent(event);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
});

describe("LumaCheckoutTracker", () => {
  it("renders nothing (null component)", () => {
    setUser(null);
    const { container } = render(<LumaCheckoutTracker />);
    expect(container.firstChild).toBeNull();
  });

  it("rejects messages from non-Luma origins", async () => {
    setUser({ uid: "u1", email: "u@test.com", displayName: "Test" });
    render(<LumaCheckoutTracker />);
    postMessage("https://evil.example.com", {
      type: "luma:checkout:complete",
      eventId: "u43ar9pi",
    });
    // Wait microtask
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRegisterForEvent).not.toHaveBeenCalled();
  });

  it("rejects messages with malformed origin URLs", async () => {
    setUser({ uid: "u1", email: "u@test.com" });
    render(<LumaCheckoutTracker />);
    postMessage("not-a-url-at-all", {
      type: "luma:checkout:complete",
      eventId: "u43ar9pi",
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRegisterForEvent).not.toHaveBeenCalled();
  });

  it("accepts exact-match lu.ma origin and registers known event", async () => {
    setUser({ uid: "u1", email: "u@test.com", displayName: "Test" });
    render(<LumaCheckoutTracker />);
    postMessage("https://lu.ma", {
      type: "luma:checkout:complete",
      eventId: "u43ar9pi",
      guestId: "g-1",
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRegisterForEvent).toHaveBeenCalledWith(
      "u1",
      "u@test.com",
      "Test",
      "u43ar9pi",
      "Cafe Cursor Boston",
      "2026-02-17",
      "g-1"
    );
  });

  it("accepts a luma.com subdomain origin", async () => {
    setUser({ uid: "u1", email: "u@test.com" });
    render(<LumaCheckoutTracker />);
    postMessage("https://app.luma.com", {
      type: "checkout:complete",
      eventId: "evt-JygYtduLJkyFgd7",
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRegisterForEvent).toHaveBeenCalled();
  });

  it("matches event=checkout_complete payload variant", async () => {
    setUser({ uid: "u1", email: "u@test.com" });
    render(<LumaCheckoutTracker />);
    postMessage("https://lu.ma", { event: "checkout_complete", eventId: "unknown-event-id" });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRegisterForEvent).toHaveBeenCalledWith(
      "u1",
      "u@test.com",
      undefined,
      "unknown-event-id",
      "Cursor Boston Event",
      undefined,
      undefined
    );
  });

  it("matches action=checkout_complete payload variant", async () => {
    setUser({ uid: "u1", email: "u@test.com" });
    render(<LumaCheckoutTracker />);
    postMessage("https://lu.ma", { action: "checkout_complete", event_id: "u43ar9pi" });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRegisterForEvent).toHaveBeenCalled();
  });

  it("falls back to lumaEventId field for the id", async () => {
    setUser({ uid: "u1", email: "u@test.com" });
    render(<LumaCheckoutTracker />);
    postMessage("https://lu.ma", {
      type: "checkout:complete",
      lumaEventId: "u43ar9pi",
      guest_id: "g-7",
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRegisterForEvent).toHaveBeenCalledWith(
      "u1",
      "u@test.com",
      undefined,
      "u43ar9pi",
      "Cafe Cursor Boston",
      "2026-02-17",
      "g-7"
    );
  });

  it("does NOT register when user is signed out", async () => {
    setUser(null);
    render(<LumaCheckoutTracker />);
    postMessage("https://lu.ma", {
      type: "luma:checkout:complete",
      eventId: "u43ar9pi",
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRegisterForEvent).not.toHaveBeenCalled();
  });

  it("does NOT register if no eventId is provided", async () => {
    setUser({ uid: "u1", email: "u@test.com" });
    render(<LumaCheckoutTracker />);
    postMessage("https://lu.ma", { type: "luma:checkout:complete" });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRegisterForEvent).not.toHaveBeenCalled();
  });

  it("swallows registerForEvent errors via try/catch", async () => {
    const consoleErr = jest.spyOn(console, "error").mockImplementation(() => {});
    mockRegisterForEvent.mockRejectedValueOnce(new Error("write failed"));
    setUser({ uid: "u1", email: "u@test.com" });
    render(<LumaCheckoutTracker />);
    postMessage("https://lu.ma", {
      type: "luma:checkout:complete",
      eventId: "u43ar9pi",
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(consoleErr).toHaveBeenCalled();
    consoleErr.mockRestore();
  });

  it("writes sessionStorage intent when a luma button is clicked", () => {
    setUser({ uid: "u1", email: "u@test.com" });
    render(<LumaCheckoutTracker />);

    const btn = document.createElement("button");
    btn.dataset.lumaEventId = "u43ar9pi";
    document.body.appendChild(btn);
    btn.click();

    const raw = sessionStorage.getItem("luma_checkout_intent");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.eventId).toBe("u43ar9pi");
    expect(parsed.userId).toBe("u1");
    expect(typeof parsed.timestamp).toBe("number");

    document.body.removeChild(btn);
  });

  it("ignores button clicks when user is signed out", () => {
    setUser(null);
    render(<LumaCheckoutTracker />);

    const btn = document.createElement("button");
    btn.dataset.lumaEventId = "u43ar9pi";
    document.body.appendChild(btn);
    btn.click();

    expect(sessionStorage.getItem("luma_checkout_intent")).toBeNull();
    document.body.removeChild(btn);
  });

  it("ignores clicks on elements without data-luma-event-id", () => {
    setUser({ uid: "u1", email: "u@test.com" });
    render(<LumaCheckoutTracker />);

    const btn = document.createElement("button");
    document.body.appendChild(btn);
    btn.click();

    expect(sessionStorage.getItem("luma_checkout_intent")).toBeNull();
    document.body.removeChild(btn);
  });
});
