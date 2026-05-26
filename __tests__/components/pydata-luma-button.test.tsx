/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `components/events/PyDataLumaButton.tsx`
 * (10% / 36 uncovered, no prior test). Covers all visibility branches
 * (auth-loading, signed-out, status-unknown, on-list) and each render
 * variant (outline, inline, primary) with fail-closed status fallback.
 */

import { render, waitFor } from "@testing-library/react";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/pydata-2026", () => ({
  PYDATA_2026_LUMA_URL: "https://lu.ma/pydata-2026",
}));

import { useAuth } from "@/contexts/AuthContext";
import { PyDataLumaButton } from "@/components/events/PyDataLumaButton";

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function setAuth(state: { user?: unknown; loading?: boolean } = {}) {
  mockUseAuth.mockReturnValue({
    user: state.user ?? null,
    userProfile: null,
    loading: state.loading ?? false,
  } as never);
}

function mockFetch(body: unknown, ok = true) {
  global.fetch = jest.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  })) as never;
}

const originalFetch = global.fetch;

afterAll(() => {
  global.fetch = originalFetch;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PyDataLumaButton", () => {
  it("renders null while auth is loading", () => {
    setAuth({ loading: true });
    const { container } = render(<PyDataLumaButton />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null when signed out", () => {
    setAuth({ user: null });
    const { container } = render(<PyDataLumaButton />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null while the Luma status is unknown (status fetch pending)", async () => {
    global.fetch = jest.fn(() => new Promise(() => undefined)) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    const { container } = render(<PyDataLumaButton />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null when the user is already on the Luma list", async () => {
    mockFetch({ onLumaList: true });
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    const { container } = render(<PyDataLumaButton />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it("renders the outline link when user is signed in and NOT on the list", async () => {
    mockFetch({ onLumaList: false });
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    const { container, findByText } = render(<PyDataLumaButton />);
    await findByText(/Also RSVP on Luma/i);
    const link = container.querySelector("a") as HTMLAnchorElement;
    expect(link.href).toContain("lu.ma/pydata-2026");
    expect(link.target).toBe("_blank");
  });

  it("renders the inline variant when variant=inline", async () => {
    mockFetch({ onLumaList: false });
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    const { container, findByText } = render(<PyDataLumaButton variant="inline" />);
    await findByText(/Also RSVP on Luma/i);
    const link = container.querySelector("a") as HTMLAnchorElement;
    // Inline variant has no SVG inside.
    expect(link.querySelector("svg")).toBeNull();
  });

  it("renders the primary variant when variant=primary", async () => {
    mockFetch({ onLumaList: false });
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    const { container, findByText } = render(<PyDataLumaButton variant="primary" />);
    await findByText(/Also RSVP on Luma/i);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("uses a custom label and className overrides when provided", async () => {
    mockFetch({ onLumaList: false });
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    const { container, findByText } = render(
      <PyDataLumaButton label="Click here" className="my-custom-class" />
    );
    await findByText("Click here");
    expect(container.querySelector(".my-custom-class")).toBeTruthy();
  });

  it("fail-closes (renders null) when the status fetch returns !ok", async () => {
    mockFetch({}, false);
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    const { container } = render(<PyDataLumaButton />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    // Brief tick for the !res.ok branch to setState
    await new Promise((r) => setTimeout(r, 10));
    expect(container.firstChild).toBeNull();
  });

  it("fail-closes (renders null) when the status fetch throws", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    const { container } = render(<PyDataLumaButton />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    expect(container.firstChild).toBeNull();
  });
});
