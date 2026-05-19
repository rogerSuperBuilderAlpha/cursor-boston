/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/talks/submit/page.tsx` was at 20%
 * statements (40 uncovered) with no dedicated test. Mirrors the
 * RequestEventPage suite: covers every page state.
 */

import "@/__tests__/app/_shared/page-test-setup";

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { useAuth } from "@/contexts/AuthContext";
import { submitTalkProposal } from "@/lib/submissions";
import SubmitTalkPage from "@/app/talks/submit/page";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/submissions", () => ({
  submitTalkProposal: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockSubmit = submitTalkProposal as jest.MockedFunction<typeof submitTalkProposal>;

function setAuth(state: { user?: unknown; userProfile?: unknown; loading?: boolean } = {}) {
  mockUseAuth.mockReturnValue({
    user: state.user ?? null,
    userProfile: state.userProfile ?? null,
    loading: state.loading ?? false,
  } as never);
}

function fillRequiredAndSubmit() {
  fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Test User" } });
  fireEvent.change(screen.getByLabelText(/Talk Title/i), {
    target: { value: "  AI in Boston  " },
  });
  fireEvent.change(screen.getByLabelText(/Description/i), {
    target: { value: "  A great talk about AI in Boston tech.  " },
  });
  fireEvent.change(screen.getByLabelText(/Category/i), { target: { value: "career" } });
  fireEvent.change(screen.getByLabelText(/Duration/i), { target: { value: "15-20" } });
  fireEvent.change(screen.getByLabelText(/Audience Level/i), { target: { value: "beginner" } });
  const form = screen
    .getByRole("button", { name: /Submit Talk Proposal/i })
    .closest("form");
  if (form) fireEvent.submit(form);
}

describe("SubmitTalkPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders a loading skeleton while auth is loading", () => {
    setAuth({ loading: true });
    const { container } = render(<SubmitTalkPage />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("renders the sign-in gate when no user is present", () => {
    setAuth({ user: null });
    render(<SubmitTalkPage />);
    expect(screen.getByText(/Sign In Required/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign In to Continue/i)).toBeInTheDocument();
  });

  it("renders the form when signed in and pre-fills email and name from the user", () => {
    setAuth({
      user: { uid: "u1", email: "user@example.com", displayName: "User Name" },
    });
    render(<SubmitTalkPage />);
    const emailInput = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
    const nameInput = screen.getByLabelText(/Full Name/i) as HTMLInputElement;
    expect(emailInput.value).toBe("user@example.com");
    expect(nameInput.value).toBe("User Name");
  });

  it("falls back to userProfile.displayName when user.displayName is missing", () => {
    setAuth({
      user: { uid: "u1", email: "user@example.com" },
      userProfile: { displayName: "Profile Name" },
    });
    render(<SubmitTalkPage />);
    const nameInput = screen.getByLabelText(/Full Name/i) as HTMLInputElement;
    expect(nameInput.value).toBe("Profile Name");
  });

  it("submits the form, trims input, and shows the success screen", async () => {
    mockSubmit.mockResolvedValue(undefined as never);
    setAuth({ user: { uid: "u1", email: "user@example.com", displayName: "Test" } });
    render(<SubmitTalkPage />);
    fillRequiredAndSubmit();

    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    const passedData = mockSubmit.mock.calls[0][0];
    expect(passedData.title).toBe("AI in Boston");
    expect(passedData.description.trim()).toBe(passedData.description);
    expect(mockSubmit.mock.calls[0][1]).toBe("u1");

    await waitFor(() =>
      expect(screen.getByText(/Proposal Submitted|Submitted/i)).toBeInTheDocument()
    );
  });

  it("shows an inline error when submitTalkProposal throws an Error", async () => {
    mockSubmit.mockRejectedValue(new Error("server unreachable"));
    setAuth({ user: { uid: "u1", email: "user@example.com", displayName: "Test" } });
    render(<SubmitTalkPage />);
    fillRequiredAndSubmit();
    await waitFor(() => expect(screen.getByText(/server unreachable/i)).toBeInTheDocument());
  });

  it("shows the generic fallback error message on non-Error throw", async () => {
    mockSubmit.mockRejectedValue("plain-string");
    setAuth({ user: { uid: "u1", email: "user@example.com", displayName: "Test" } });
    render(<SubmitTalkPage />);
    fillRequiredAndSubmit();
    await waitFor(() => expect(screen.getByText(/Failed to submit/i)).toBeInTheDocument());
  });

  it("resets form when Submit Another is clicked from the success screen", async () => {
    mockSubmit.mockResolvedValue(undefined as never);
    setAuth({ user: { uid: "u1", email: "user@example.com", displayName: "Test" } });
    render(<SubmitTalkPage />);
    fillRequiredAndSubmit();
    await waitFor(() => expect(screen.getByText(/Submitted/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Submit Another/i }));
    expect(screen.getByLabelText(/Talk Title/i)).toBeInTheDocument();
  });
});
