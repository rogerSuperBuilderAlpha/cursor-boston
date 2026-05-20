/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/auth/ludwitt-finalize/page.tsx` (0% /
 * 12 uncovered branches). Covers happy path (returnTo default + custom),
 * !res.ok error → /login redirect, missing-token error, missing auth
 * (firebase_not_initialized) error, signInWithCustomToken throw.
 */

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";

const mockReplace = jest.fn();
const stableRouter = { replace: mockReplace, push: jest.fn(), back: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() };

let searchParamsValue = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => stableRouter,
  useSearchParams: () => searchParamsValue,
}));

const mockSignInWithCustomToken = jest.fn();

jest.mock("firebase/auth", () => ({
  signInWithCustomToken: (...args: unknown[]) => mockSignInWithCustomToken(...args),
}));

let firebaseAuth: unknown = { name: "auth" };
jest.mock("@/lib/firebase", () => ({
  get auth() {
    return firebaseAuth;
  },
}));

import LudwittFinalizePage from "@/app/auth/ludwitt-finalize/page";

const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  searchParamsValue = new URLSearchParams();
  firebaseAuth = { name: "auth" };
  mockSignInWithCustomToken.mockResolvedValue({});
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("LudwittFinalizePage", () => {
  it("renders the 'Signing you in…' shell", () => {
    global.fetch = jest.fn(() => new Promise(() => undefined)) as never;
    render(<LudwittFinalizePage />);
    expect(screen.getByText(/Signing you in with Ludwitt/)).toBeInTheDocument();
  });

  it("happy path: finalize → signInWithCustomToken → router.replace('/')", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ token: "custom-token" }),
    })) as never;
    render(<LudwittFinalizePage />);
    await waitFor(() => {
      expect(mockSignInWithCustomToken).toHaveBeenCalledWith({ name: "auth" }, "custom-token");
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
  });

  it("uses ?returnTo= when provided", async () => {
    searchParamsValue = new URLSearchParams("returnTo=/profile");
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ token: "custom-token" }),
    })) as never;
    render(<LudwittFinalizePage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/profile"));
  });

  it("redirects to /login on !res.ok", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })) as never;
    render(<LudwittFinalizePage />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        "/login?ludwitt=error&message=finalize_failed"
      )
    );
    expect(mockSignInWithCustomToken).not.toHaveBeenCalled();
  });

  it("redirects to /login when token is missing in response", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })) as never;
    render(<LudwittFinalizePage />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        "/login?ludwitt=error&message=finalize_failed"
      )
    );
  });

  it("redirects to /login when auth is not initialized", async () => {
    firebaseAuth = null;
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ token: "custom-token" }),
    })) as never;
    render(<LudwittFinalizePage />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        "/login?ludwitt=error&message=finalize_failed"
      )
    );
    expect(mockSignInWithCustomToken).not.toHaveBeenCalled();
  });

  it("redirects to /login when signInWithCustomToken throws", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ token: "custom-token" }),
    })) as never;
    mockSignInWithCustomToken.mockRejectedValueOnce(new Error("auth/invalid"));
    render(<LudwittFinalizePage />);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        "/login?ludwitt=error&message=finalize_failed"
      )
    );
  });
});
