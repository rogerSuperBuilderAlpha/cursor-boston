/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/events/request/page.tsx` (was 20% / 40
 * uncovered statements, no dedicated test). Covers every state-machine
 * branch: auth loading, signed-out gate, form fill, success, error,
 * non-Error fallback, and Submit-Another reset.
 */

import "@/__tests__/app/_shared/page-test-setup";

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { useAuth } from "@/contexts/AuthContext";
import { submitEventRequest } from "@/lib/submissions";
import RequestEventPage from "@/app/events/request/page";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/submissions", () => ({
  submitEventRequest: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockSubmit = submitEventRequest as jest.MockedFunction<typeof submitEventRequest>;

function setAuth(state: { user?: unknown; userProfile?: unknown; loading?: boolean } = {}) {
  mockUseAuth.mockReturnValue({
    user: state.user ?? null,
    userProfile: state.userProfile ?? null,
    loading: state.loading ?? false,
  } as never);
}

function fillRequiredAndSubmit() {
  fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Test User" } });
  fireEvent.change(screen.getByLabelText(/Event Title/i), {
    target: { value: "  Build Boston  " },
  });
  fireEvent.change(screen.getByLabelText(/Description/i), {
    target: { value: "  We host Boston devs to build cool stuff.  " },
  });
  const radios = screen.getAllByRole("radio");
  fireEvent.click(radios[0]);
  fireEvent.change(screen.getByLabelText(/Expected Attendees/i), {
    target: { value: "10-25" },
  });
  const form = screen
    .getByRole("button", { name: /Submit Event Request/i })
    .closest("form");
  if (form) fireEvent.submit(form);
}

describe("RequestEventPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the AuthFormSkeleton while auth is loading", () => {
    setAuth({ loading: true });
    const { container } = render(<RequestEventPage />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("renders the sign-in gate when no user is present", () => {
    setAuth({ user: null });
    render(<RequestEventPage />);
    expect(screen.getByText(/Sign In Required/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign In to Continue/i)).toBeInTheDocument();
  });

  it("renders the form when signed in and pre-fills email + name from the user", () => {
    setAuth({
      user: { uid: "u1", email: "user@example.com", displayName: "User Name" },
    });
    render(<RequestEventPage />);
    expect(screen.getByRole("heading", { name: /Request an Event/i })).toBeInTheDocument();
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
    render(<RequestEventPage />);
    const nameInput = screen.getByLabelText(/Full Name/i) as HTMLInputElement;
    expect(nameInput.value).toBe("Profile Name");
  });

  it("submits the form, trims input, and shows the success screen", async () => {
    mockSubmit.mockResolvedValue(undefined as never);
    setAuth({ user: { uid: "u1", email: "user@example.com", displayName: "Test" } });
    render(<RequestEventPage />);
    fillRequiredAndSubmit();

    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    const passedData = mockSubmit.mock.calls[0][0];
    expect(passedData.title).toBe("Build Boston");
    expect(passedData.description.trim()).toBe(passedData.description);
    expect(mockSubmit.mock.calls[0][1]).toBe("u1");

    await waitFor(() =>
      expect(screen.getByText(/Request Submitted/i)).toBeInTheDocument()
    );
  });

  it("shows an inline error when submitEventRequest throws an Error", async () => {
    mockSubmit.mockRejectedValue(new Error("network down"));
    setAuth({ user: { uid: "u1", email: "user@example.com", displayName: "Test" } });
    render(<RequestEventPage />);
    fillRequiredAndSubmit();
    await waitFor(() => expect(screen.getByText(/network down/i)).toBeInTheDocument());
  });

  it("shows the generic fallback error message on non-Error throw", async () => {
    mockSubmit.mockRejectedValue("plain-string");
    setAuth({ user: { uid: "u1", email: "user@example.com", displayName: "Test" } });
    render(<RequestEventPage />);
    fillRequiredAndSubmit();
    await waitFor(() => expect(screen.getByText(/Failed to submit/i)).toBeInTheDocument());
  });

  it("resets form when Submit Another is clicked from the success screen", async () => {
    mockSubmit.mockResolvedValue(undefined as never);
    setAuth({ user: { uid: "u1", email: "user@example.com", displayName: "Test" } });
    render(<RequestEventPage />);
    fillRequiredAndSubmit();
    await waitFor(() => expect(screen.getByText(/Request Submitted/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Submit Another/i }));
    expect(screen.getByRole("heading", { name: /Request an Event/i })).toBeInTheDocument();
  });
});
