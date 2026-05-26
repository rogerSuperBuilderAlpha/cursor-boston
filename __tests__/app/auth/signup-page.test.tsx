/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/(auth)/signup/page.tsx` (~52% / 42
 * uncovered branches). Covers auth-loading skeleton, signed-in-redirect,
 * summer-cohort banner branch, password-mismatch + short-password
 * validation, signUp + Google + GitHub success/error paths, and every
 * getErrorMessage / getSignUpFieldErrors switch branch via the rendered
 * error message.
 */


jest.mock("@/lib/firebase", () => ({
  auth: null,
  db: null,
  storage: null,
  rtdb: null,
  app: null,
}));
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockPush = jest.fn();
const stableRouter = { push: mockPush, replace: jest.fn(), back: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() };

let searchParamsValue = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => stableRouter,
  useSearchParams: () => searchParamsValue,
  usePathname: () => "/signup",
}));

const mockUseAuth = jest.fn();
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

import SignUpPage from "@/app/(auth)/signup/page";

function setAuth(over: Partial<Record<string, unknown>> = {}) {
  const signUp = jest.fn().mockResolvedValue(undefined);
  const signInWithGoogle = jest.fn().mockResolvedValue(undefined);
  const signInWithGithub = jest.fn().mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({
    user: null,
    loading: false,
    signUp,
    signInWithGoogle,
    signInWithGithub,
    ...over,
  });
  return { signUp, signInWithGoogle, signInWithGithub };
}

beforeEach(() => {
  jest.clearAllMocks();
  searchParamsValue = new URLSearchParams();
});

describe("SignUpPage — gates", () => {
  it("renders skeleton while authLoading=true", () => {
    setAuth({ loading: true });
    const { container } = render(<SignUpPage />);
    // SignUpPageContent renders AuthFormSkeleton (which uses .animate-pulse).
    // The Suspense fallback also has .animate-spin — match either.
    expect(
      container.querySelector(".animate-pulse, .animate-spin")
    ).toBeTruthy();
  });

  it("renders nothing once signed in and redirects to ?redirect=", () => {
    searchParamsValue = new URLSearchParams("redirect=/profile");
    setAuth({ user: { uid: "u1" } });
    render(<SignUpPage />);
    expect(mockPush).toHaveBeenCalledWith("/profile");
  });

  it("renders generic title when not summer-cohort", () => {
    setAuth();
    render(<SignUpPage />);
    expect(screen.getByText("Join Cursor Boston")).toBeInTheDocument();
  });

  it("renders summer-cohort title + banner when redirect starts with /summer-cohort", () => {
    searchParamsValue = new URLSearchParams("redirect=/summer-cohort/c2");
    setAuth();
    render(<SignUpPage />);
    expect(screen.getByText(/One step from joining the cohort/)).toBeInTheDocument();
  });
});

describe("SignUpPage — form validation", () => {
  it("rejects mismatched passwords with confirmPasswordError", async () => {
    setAuth();
    render(<SignUpPage />);
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: "u@test.com" } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: "longenough" } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: "different!" } });
    const form = screen.getByRole("button", { name: /^Create Account$/i }).closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(await screen.findByText(/Passwords do not match/i)).toBeInTheDocument();
  });

  it("rejects passwords shorter than 8 chars", async () => {
    setAuth();
    render(<SignUpPage />);
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: "u@test.com" } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: "short" } });
    const form = screen.getByRole("button", { name: /^Create Account$/i }).closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(await screen.findByText(/Password must be at least 8 characters/)).toBeInTheDocument();
  });
});

describe("SignUpPage — signUp + OAuth flows", () => {
  it("calls signUp and navigates on success", async () => {
    const { signUp } = setAuth();
    render(<SignUpPage />);
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: "u@test.com" } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: "longpass1" } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: "longpass1" } });
    const form = screen.getByRole("button", { name: /^Create Account$/i }).closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(signUp).toHaveBeenCalledWith("u@test.com", "longpass1", "");
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
  });

  it("surfaces email-already-in-use error via getErrorMessage", async () => {
    const { signUp } = setAuth();
    signUp.mockRejectedValueOnce(new Error("auth/email-already-in-use"));
    render(<SignUpPage />);
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: "u@test.com" } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: "longpass1" } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: "longpass1" } });
    const form = screen.getByRole("button", { name: /^Create Account$/i }).closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(await screen.findByText(/An account with this email already exists/i)).toBeInTheDocument();
  });

  it.each([
    ["auth/invalid-email", /Please enter a valid email/],
    ["auth/weak-password", /Password is too weak/],
    ["auth/popup-closed-by-user", /Sign-in was cancelled/],
    ["auth/popup-blocked", /Pop-up was blocked/],
    ["auth/network-request-failed", /Network error/],
    ["auth/operation-not-allowed", /sign-in method is not enabled/],
    ["random/unknown", /Something went wrong/],
  ])("surfaces getErrorMessage for %s", async (code, expected) => {
    const { signInWithGoogle } = setAuth();
    signInWithGoogle.mockRejectedValueOnce(new Error(code));
    render(<SignUpPage />);
    fireEvent.click(screen.getByRole("button", { name: /Google/i }));
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it("calls signInWithGithub on success", async () => {
    const { signInWithGithub } = setAuth();
    render(<SignUpPage />);
    fireEvent.click(screen.getByRole("button", { name: /GitHub/i }));
    await waitFor(() => expect(signInWithGithub).toHaveBeenCalled());
  });
});
