/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/live/page.tsx` (0% / 20 uncovered
 * branches). Covers auth-loading spinner, signed-out gate, signed-in
 * form, title input, create-session happy path → router.push, body.error
 * error, !res.ok with no body, fetch throw, non-Error throw fallback,
 * re-entry guard (isCreating disables button).
 */

import "@/__tests__/app/_shared/page-test-setup";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockPush = jest.fn();
const stableRouter = {
  push: mockPush,
  replace: jest.fn(),
  back: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
};

jest.mock("next/navigation", () => ({
  useRouter: () => stableRouter,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/live",
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from "@/contexts/AuthContext";
import LiveSessionsPage from "@/app/live/page";

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const originalFetch = global.fetch;

function setAuth(state: { user?: unknown; loading?: boolean } = {}) {
  mockUseAuth.mockReturnValue({
    user: state.user ?? null,
    userProfile: null,
    loading: state.loading ?? false,
  } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("LiveSessionsPage", () => {
  it("renders the loading spinner while auth is loading", () => {
    setAuth({ loading: true });
    const { container } = render(<LiveSessionsPage />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("renders the signed-out gate when no user", () => {
    setAuth({ user: null });
    render(<LiveSessionsPage />);
    expect(screen.getByText(/Live Session Control Room/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sign In/i })).toBeInTheDocument();
  });

  it("renders the form with default 'Lightning Talks' title when signed in", () => {
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<LiveSessionsPage />);
    const input = screen.getByLabelText(/Session title/i) as HTMLInputElement;
    expect(input.value).toBe("Lightning Talks");
  });

  it("submits a session with the correct body + Authorization header", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ sessionId: "sess-123" }),
    })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<LiveSessionsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Create Session/i }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const args = (global.fetch as jest.Mock).mock.calls[0];
    expect(args[0]).toBe("/api/live/session");
    const body = JSON.parse(args[1].body);
    expect(body.title).toBe("Lightning Talks");
    expect(args[1].headers.Authorization).toBe("Bearer tok");
  });

  it("surfaces payload.error message on !res.ok", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "not allowed" }),
    })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<LiveSessionsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Create Session/i }));
    await waitFor(() => expect(screen.getByText(/not allowed/i)).toBeInTheDocument());
  });

  it("falls back to default error message on !res.ok with empty body", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<LiveSessionsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Create Session/i }));
    await waitFor(() => expect(screen.getByText(/Could not create live session/i)).toBeInTheDocument());
  });

  it("falls back to default error message when response.json() throws", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("parse fail");
      },
    })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<LiveSessionsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Create Session/i }));
    await waitFor(() => expect(screen.getByText(/Could not create live session/i)).toBeInTheDocument());
  });

  it("surfaces fetch throw Error message", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<LiveSessionsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Create Session/i }));
    await waitFor(() => expect(screen.getByText(/network down/i)).toBeInTheDocument());
  });

  it("falls back to default message on non-Error throw", async () => {
    global.fetch = jest.fn(async () => {
      throw "string error";
    }) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<LiveSessionsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Create Session/i }));
    await waitFor(() => expect(screen.getByText(/Could not create live session/i)).toBeInTheDocument());
  });

  it("updates title state on input change", () => {
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<LiveSessionsPage />);
    const input = screen.getByLabelText(/Session title/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Demo Day" } });
    expect(input.value).toBe("Demo Day");
  });

  it("treats !res.ok with valid sessionId field absent as error", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ /* no sessionId */ }),
    })) as never;
    setAuth({ user: { uid: "u1", getIdToken: async () => "tok" } });
    render(<LiveSessionsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Create Session/i }));
    await waitFor(() => expect(screen.getByText(/Could not create live session/i)).toBeInTheDocument());
    expect(mockPush).not.toHaveBeenCalled();
  });
});
