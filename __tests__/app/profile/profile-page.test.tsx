/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/(auth)/profile/page.tsx` was at 37%
 * statements / 0% branches with 21 uncovered branches. Targets the
 * outer shell (auth-loading, redirect-when-signed-out, render-when-
 * signed-in) and the ?section= query param branches (default, settings,
 * security). Uses heavy mocking so this exercises only the page's own
 * conditional logic, not its deep child trees.
 */

import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@/lib/firebase", () => ({
  auth: null,
  db: null,
  storage: null,
  rtdb: null,
  app: null,
}));

const mockPush = jest.fn();
const stableRouter = {
  push: mockPush,
  replace: jest.fn(),
  back: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
};

let mockSearchParamsValue = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => stableRouter,
  useSearchParams: () => mockSearchParamsValue,
  usePathname: () => "/profile",
}));

const mockUseAuth = jest.fn();
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockUseProfileContext = jest.fn();
jest.mock("@/app/(auth)/profile/_contexts/ProfileContext", () => ({
  ProfileProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useProfileContext: () => mockUseProfileContext(),
}));

jest.mock("@/app/(auth)/profile/_hooks/useOAuthCallbacks", () => ({
  useOAuthCallbacks: jest.fn(),
}));

// Stub child components so they don't pull in their own dependencies.
jest.mock("@/app/(auth)/profile/_components/ProfileHeader", () => ({
  ProfileHeader: () => <div>ProfileHeader</div>,
}));
jest.mock("@/app/(auth)/profile/_components/OnboardingChecklist", () => ({
  OnboardingChecklist: () => <div>OnboardingChecklist</div>,
}));
jest.mock("@/app/(auth)/profile/_components/ConnectionsSection", () => ({
  ConnectionsSection: () => <div>ConnectionsSection</div>,
}));
jest.mock("@/app/(auth)/profile/_components/StatsGrid", () => ({
  StatsGrid: () => <div>StatsGrid</div>,
}));
jest.mock("@/app/(auth)/profile/_components/EarnedBadgesSection", () => ({
  EarnedBadgesSection: () => <div>EarnedBadgesSection</div>,
}));
jest.mock("@/app/(auth)/profile/_components/ActivitySection", () => ({
  ActivitySection: () => <div>ActivitySection</div>,
}));
jest.mock("@/app/(auth)/profile/_components/SecurityTab", () => ({
  SecurityTab: () => <div>SecurityTab</div>,
}));
jest.mock("@/app/(auth)/profile/_components/SettingsTab", () => ({
  SettingsTab: () => <div>SettingsTab</div>,
}));
jest.mock("@/app/(auth)/profile/_components/EditProfileModal", () => ({
  EditProfileModal: () => <div>EditProfileModal</div>,
}));

import ProfilePage from "@/app/(auth)/profile/page";

function makeProfileCtx() {
  return {
    user: { uid: "u1", email: "u@test.com" },
    userProfile: { additionalEmails: [] },
    data: { connectedAgents: [], loadingAgents: false },
    discord: { discordInfo: null, connect: jest.fn(), disconnect: jest.fn() },
    github: { githubInfo: null, connect: jest.fn(), disconnect: jest.fn() },
    ludwitt: { ludwittInfo: null, connect: jest.fn(), disconnect: jest.fn() },
    cursor: { cursorInfo: null, connect: jest.fn(), disconnect: jest.fn() },
    google: {
      hasGoogleProvider: false,
      hasPasswordProvider: false,
      resetIfReconnected: jest.fn(),
      disconnect: jest.fn(),
    },
    mfa: { clearRecaptcha: jest.fn() },
    email: {},
    profileSettings: {
      settings: {},
      setSettings: jest.fn(),
      saving: false,
      error: null,
      success: null,
      save: jest.fn(),
      toggleAllVisibility: jest.fn(),
    },
    password: {
      setPassword: jest.fn(),
      saving: false,
      error: null,
      success: false,
    },
    refreshUserProfile: jest.fn(),
  };
}

function setAuth(state: { user?: unknown; loading?: boolean } = {}) {
  mockUseAuth.mockReturnValue({
    user: state.user ?? null,
    userProfile: null,
    loading: state.loading ?? false,
    updateUserProfile: jest.fn(),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParamsValue = new URLSearchParams();
  mockUseProfileContext.mockReturnValue(makeProfileCtx());
});

describe("ProfilePage shell", () => {
  it("renders loading spinner while auth is loading", () => {
    setAuth({ loading: true });
    const { container } = render(<ProfilePage />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("redirects to /login?redirect=/profile when signed out", () => {
    setAuth({ user: null });
    render(<ProfilePage />);
    expect(mockPush).toHaveBeenCalledWith("/login?redirect=/profile");
  });

  it("renders null body (besides Suspense fallback) when signed out", () => {
    setAuth({ user: null });
    const { container } = render(<ProfilePage />);
    // No spinner once not loading; user-null branch returns null
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("renders the full profile content when signed in", () => {
    setAuth({ user: { uid: "u1" } });
    render(<ProfilePage />);
    expect(screen.getByText("ProfileHeader")).toBeInTheDocument();
    expect(screen.getByText("OnboardingChecklist")).toBeInTheDocument();
    expect(screen.getByText("ConnectionsSection")).toBeInTheDocument();
  });

  it("opens settings panel automatically when ?section=settings", () => {
    setAuth({ user: { uid: "u1" } });
    mockSearchParamsValue = new URLSearchParams("section=settings");
    render(<ProfilePage />);
    expect(screen.getByText("SettingsTab")).toBeInTheDocument();
  });

  it("opens security panel automatically when ?section=security", () => {
    setAuth({ user: { uid: "u1" } });
    mockSearchParamsValue = new URLSearchParams("section=security");
    render(<ProfilePage />);
    expect(screen.getByText("SecurityTab")).toBeInTheDocument();
  });

  it("does NOT open either panel by default", () => {
    setAuth({ user: { uid: "u1" } });
    render(<ProfilePage />);
    expect(screen.queryByText("SettingsTab")).not.toBeInTheDocument();
    expect(screen.queryByText("SecurityTab")).not.toBeInTheDocument();
  });
});
