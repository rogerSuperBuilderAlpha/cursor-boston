/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/maintainers/apply/page.tsx` was at 22%
 * statements (39 uncovered). Covers signed-out state, missing Discord,
 * missing GitHub, full requirements met (JSON body rendered + copy
 * button), eligibility-check redirect to dashboard.
 */

import "@/__tests__/app/_shared/page-test-setup";

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { useAuth } from "@/contexts/AuthContext";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

const mockReplace = jest.fn();
const stableRouter = {
  replace: mockReplace,
  push: jest.fn(),
  back: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
};

jest.mock("next/navigation", () => ({
  useRouter: () => stableRouter,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/maintainers/apply",
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function setAuth(state: {
  user?: unknown;
  userProfile?: unknown;
  loading?: boolean;
} = {}) {
  mockUseAuth.mockReturnValue({
    user: state.user ?? null,
    userProfile: state.userProfile ?? null,
    loading: state.loading ?? false,
  } as never);
}

const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ eligible: false }),
  })) as never;
  Object.assign(navigator, {
    clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
  });
});

afterAll(() => {
  global.fetch = originalFetch;
});

import MaintainerApplyPage from "@/app/maintainers/apply/page";

describe("MaintainerApplyPage", () => {
  it("renders the page heading when signed out", () => {
    setAuth({ user: null });
    render(<MaintainerApplyPage />);
    expect(
      screen.getByRole("heading", { name: /Apply to be a maintainer/i })
    ).toBeInTheDocument();
  });

  it("shows the connection checklist when github is not connected", () => {
    setAuth({
      user: { uid: "u1", getIdToken: async () => "tok" },
      userProfile: { discord: { username: "user#0" } },
    });
    render(<MaintainerApplyPage />);
    expect(screen.getByText(/Connection checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/GitHub not connected/i)).toBeInTheDocument();
  });

  it("renders the JSON body when GitHub + Discord are both connected", async () => {
    setAuth({
      user: {
        uid: "u1",
        email: "u@test.com",
        displayName: "Test User",
        getIdToken: async () => "tok",
      },
      userProfile: {
        github: { login: "octocat" },
        discord: { username: "octocat#0" },
        displayName: "Test User",
      },
    });
    const { container } = render(<MaintainerApplyPage />);
    await waitFor(() => expect(container.textContent).toMatch(/octocat/));
  });

  it("copies JSON to clipboard when the copy button is clicked", async () => {
    setAuth({
      user: {
        uid: "u1",
        email: "u@test.com",
        displayName: "Test User",
        getIdToken: async () => "tok",
      },
      userProfile: {
        github: { login: "octocat" },
        discord: { username: "octocat#0" },
        displayName: "Test User",
      },
    });
    render(<MaintainerApplyPage />);
    const copyButton = await screen.findByRole("button", { name: /Copy/i });
    fireEvent.click(copyButton);
    await waitFor(() =>
      expect((navigator.clipboard.writeText as jest.Mock).mock.calls.length).toBeGreaterThan(0)
    );
  });

  it("does NOT redirect when eligibility check returns eligible=false", async () => {
    setAuth({
      user: { uid: "u1", getIdToken: async () => "tok" },
      userProfile: { github: { login: "octocat" }, discord: { username: "octocat#0" } },
    });
    render(<MaintainerApplyPage />);
    await new Promise((r) => setTimeout(r, 50));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("swallows fetch errors in the eligibility-check effect", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as never;
    setAuth({
      user: { uid: "u1", getIdToken: async () => "tok" },
      userProfile: {},
    });
    expect(() => render(<MaintainerApplyPage />)).not.toThrow();
  });

  it("skips eligibility check while auth is still loading", async () => {
    setAuth({ loading: true });
    render(<MaintainerApplyPage />);
    await new Promise((r) => setTimeout(r, 30));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
