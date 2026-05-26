/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/admin/page.tsx` (0% / 10 uncovered
 * branches). Covers loading gate, redirect-when-not-admin, redirect-
 * when-signed-out, render-when-admin.
 */

import { render, screen } from "@testing-library/react";

const mockPush = jest.fn();
const stableRouter = { push: mockPush, replace: jest.fn(), back: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() };

jest.mock("next/navigation", () => ({
  useRouter: () => stableRouter,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin",
}));

const mockUseAuth = jest.fn();
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import AdminIndexPage from "@/app/admin/page";

function setAuth(state: { user?: unknown; userProfile?: unknown; loading?: boolean } = {}) {
  mockUseAuth.mockReturnValue({
    user: state.user ?? null,
    userProfile: state.userProfile ?? null,
    loading: state.loading ?? false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AdminIndexPage", () => {
  it("renders 'Loading…' while auth is loading", () => {
    setAuth({ loading: true });
    render(<AdminIndexPage />);
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("redirects to / when signed out", () => {
    setAuth({ user: null });
    render(<AdminIndexPage />);
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("redirects to / when user is signed in but not admin", () => {
    setAuth({ user: { uid: "u1" }, userProfile: { isAdmin: false } });
    render(<AdminIndexPage />);
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("redirects to / when userProfile is null", () => {
    setAuth({ user: { uid: "u1" }, userProfile: null });
    render(<AdminIndexPage />);
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("renders the admin links when user is admin", () => {
    setAuth({ user: { uid: "u1" }, userProfile: { isAdmin: true } });
    render(<AdminIndexPage />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Community moderation queue/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Summer cohort dashboard/ })).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does NOT redirect while still loading even if no user", () => {
    setAuth({ loading: true, user: null });
    render(<AdminIndexPage />);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
