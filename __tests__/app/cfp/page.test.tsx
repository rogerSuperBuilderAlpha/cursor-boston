/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/cfp/page.tsx` (was 44.7% branches / 47
 * uncovered). Covers the state-machine branches: auth-loading skeleton,
 * signed-out gate, .edu-email gate (send/verify code, error paths),
 * post-deadline closed state, pre-fill from existing submission,
 * happy-path submit, submit error variants, and submitted state with
 * Edit Submission reset.
 */

import "@/__tests__/app/_shared/page-test-setup";

import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { useAuth } from "@/contexts/AuthContext";
import {
  submitCfpProposal,
  getCfpSubmission,
  countWords,
  hasVerifiedEduEmail,
  getVerifiedEduEmail,
} from "@/lib/cfp-submissions";
import CfpPage from "@/app/cfp/page";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/cfp-submissions", () => ({
  submitCfpProposal: jest.fn(),
  getCfpSubmission: jest.fn(),
  countWords: jest.fn(),
  hasVerifiedEduEmail: jest.fn(),
  getVerifiedEduEmail: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockSubmit = submitCfpProposal as jest.MockedFunction<typeof submitCfpProposal>;
const mockGet = getCfpSubmission as jest.MockedFunction<typeof getCfpSubmission>;
const mockCountWords = countWords as jest.MockedFunction<typeof countWords>;
const mockHasEdu = hasVerifiedEduEmail as jest.MockedFunction<
  typeof hasVerifiedEduEmail
>;
const mockGetEdu = getVerifiedEduEmail as jest.MockedFunction<
  typeof getVerifiedEduEmail
>;

type AuthState = {
  user?: unknown;
  userProfile?: unknown;
  loading?: boolean;
  refreshUserProfile?: () => Promise<void>;
};

function setAuth(state: AuthState = {}) {
  mockUseAuth.mockReturnValue({
    user: state.user ?? null,
    userProfile: state.userProfile ?? null,
    loading: state.loading ?? false,
    refreshUserProfile: state.refreshUserProfile ?? jest.fn(),
  } as never);
}

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  (global as { fetch: jest.Mock }).fetch = jest
    .fn()
    .mockResolvedValueOnce({
      ok,
      status,
      json: async () => body,
    });
}

const signedInUser = {
  uid: "user-1",
  email: "user@university.edu",
  displayName: "Ada Lovelace",
  getIdToken: jest.fn().mockResolvedValue("fake-id-token"),
};

const nonEduUser = {
  uid: "user-2",
  email: "user@gmail.com",
  displayName: "Some Name",
  getIdToken: jest.fn().mockResolvedValue("fake-id-token"),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCountWords.mockImplementation((t: string) =>
    !t ? 0 : t.trim().split(/\s+/).filter(Boolean).length
  );
  mockHasEdu.mockReturnValue(true);
  mockGetEdu.mockReturnValue("user@university.edu");
  mockGet.mockResolvedValue(null);
  mockSubmit.mockResolvedValue(undefined as never);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("CfpPage — gates", () => {
  it("renders the auth-loading spinner while auth is loading", () => {
    setAuth({ loading: true });
    const { container } = render(<CfpPage />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("renders the sign-in gate when no user is present", () => {
    setAuth({ user: null });
    render(<CfpPage />);
    expect(screen.getByText(/Sign In Required/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign In to Continue/i)).toBeInTheDocument();
  });

  it("renders the .edu-email gate when user has no verified .edu email", () => {
    mockHasEdu.mockReturnValue(false);
    mockGetEdu.mockReturnValue(null);
    setAuth({ user: nonEduUser });
    render(<CfpPage />);
    expect(screen.getByText(/Verify your .edu email/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Send verification code/i })
    ).toBeDisabled();
  });

  it("renders the closed gate when after the submission deadline", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
    setAuth({ user: signedInUser });
    render(<CfpPage />);
    await waitFor(() =>
      expect(screen.getByText(/Submissions Closed/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/Back to Home/i)).toBeInTheDocument();
  });
});

describe("CfpPage — .edu verification flow", () => {
  beforeEach(() => {
    mockHasEdu.mockReturnValue(false);
    mockGetEdu.mockReturnValue(null);
    setAuth({ user: nonEduUser });
  });

  it("enables send-code button only when input ends with .edu", () => {
    render(<CfpPage />);
    const input = screen.getByLabelText(/\.edu Email address/i);
    fireEvent.change(input, { target: { value: "ada@gmail.com" } });
    expect(
      screen.getByRole("button", { name: /Send verification code/i })
    ).toBeDisabled();
    fireEvent.change(input, { target: { value: "ada@mit.edu" } });
    expect(
      screen.getByRole("button", { name: /Send verification code/i })
    ).not.toBeDisabled();
  });

  it("sends code, transitions to code-entry view, and shows email back to the user", async () => {
    mockFetchOnce({ ok: true });
    render(<CfpPage />);
    fireEvent.change(screen.getByLabelText(/\.edu Email address/i), {
      target: { value: "ada@mit.edu" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Send verification code/i })
    );

    await waitFor(() =>
      expect(screen.getByLabelText(/Verification code/i)).toBeInTheDocument()
    );
    expect(screen.getByText("ada@mit.edu")).toBeInTheDocument();
  });

  it("shows API error message when /send-edu-code fails (non-ok json)", async () => {
    mockFetchOnce({ error: "Domain not allowed" }, false, 400);
    render(<CfpPage />);
    fireEvent.change(screen.getByLabelText(/\.edu Email address/i), {
      target: { value: "ada@mit.edu" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Send verification code/i })
    );
    await waitFor(() =>
      expect(screen.getByText(/Domain not allowed/i)).toBeInTheDocument()
    );
  });

  it("falls back to generic error when send-code rejects with a non-Error", async () => {
    (global as { fetch: jest.Mock }).fetch = jest
      .fn()
      .mockRejectedValueOnce("network-string");
    render(<CfpPage />);
    fireEvent.change(screen.getByLabelText(/\.edu Email address/i), {
      target: { value: "ada@mit.edu" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Send verification code/i })
    );
    await waitFor(() =>
      expect(screen.getByText(/Failed to send code/i)).toBeInTheDocument()
    );
  });

  it("verifies the code on happy-path and calls refreshUserProfile", async () => {
    const refreshUserProfile = jest.fn().mockResolvedValue(undefined);
    setAuth({ user: nonEduUser, refreshUserProfile });

    // 1st fetch: send-code
    (global as { fetch: jest.Mock }).fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    render(<CfpPage />);
    fireEvent.change(screen.getByLabelText(/\.edu Email address/i), {
      target: { value: "ada@mit.edu" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Send verification code/i })
    );
    await waitFor(() =>
      expect(screen.getByLabelText(/Verification code/i)).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText(/Verification code/i), {
      target: { value: "123abc456" }, // non-digits stripped by handler
    });
    fireEvent.click(screen.getByRole("button", { name: /^Verify$/i }));

    await waitFor(() => expect(refreshUserProfile).toHaveBeenCalled());
  });

  it("shows verify error when verify-edu-code returns non-ok", async () => {
    (global as { fetch: jest.Mock }).fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Bad code" }),
      });

    render(<CfpPage />);
    fireEvent.change(screen.getByLabelText(/\.edu Email address/i), {
      target: { value: "ada@mit.edu" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Send verification code/i })
    );
    await waitFor(() =>
      expect(screen.getByLabelText(/Verification code/i)).toBeInTheDocument()
    );
    fireEvent.change(screen.getByLabelText(/Verification code/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Verify$/i }));

    await waitFor(() =>
      expect(screen.getByText(/Bad code/i)).toBeInTheDocument()
    );
  });

  it("allows backing out of code-entry via the Use-different-email button", async () => {
    mockFetchOnce({ ok: true });
    render(<CfpPage />);
    fireEvent.change(screen.getByLabelText(/\.edu Email address/i), {
      target: { value: "ada@mit.edu" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Send verification code/i })
    );
    await waitFor(() =>
      expect(screen.getByLabelText(/Verification code/i)).toBeInTheDocument()
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Use different email/i })
    );
    expect(screen.getByLabelText(/\.edu Email address/i)).toBeInTheDocument();
  });
});

describe("CfpPage — form (signed-in, verified .edu, before deadline)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-04-01T12:00:00.000Z"));
    setAuth({ user: signedInUser });
  });

  it("renders the submission form and pre-fills name + .edu email", async () => {
    render(<CfpPage />);
    await waitFor(() =>
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument()
    );
    const nameInput = screen.getByLabelText(/Full Name/i) as HTMLInputElement;
    expect(nameInput.value).toBe("Ada Lovelace");
    const emailInput = screen.getByLabelText(/\.edu Email/i) as HTMLInputElement;
    expect(emailInput.value).toBe("user@university.edu");
    expect(emailInput.readOnly).toBe(true);
    expect(
      screen.getByText(/Using your verified \.edu address/i)
    ).toBeInTheDocument();
  });

  it("disables submit when the abstract is below the minimum word count", async () => {
    render(<CfpPage />);
    await waitFor(() =>
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument()
    );
    const button = screen.getByRole("button", { name: /Submit Paper/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/0 words \(1,500–2,500 required\)/i)).toBeInTheDocument();
  });

  it("loads and pre-fills from an existing submission, shows Update button", async () => {
    mockGet.mockResolvedValue({
      abstract: "word ".repeat(1600).trim(),
      name: "Existing Name",
      email: "existing@university.edu",
      school: "MIT",
      department: "EECS",
      advisor: "Prof X",
      thesisTitle: "Existing Thesis",
      userId: "user-1",
    } as never);

    render(<CfpPage />);
    await waitFor(() =>
      expect(
        (screen.getByLabelText(/Full Name/i) as HTMLInputElement).value
      ).toBe("Existing Name")
    );
    expect(
      (screen.getByLabelText(/School \/ University/i) as HTMLInputElement).value
    ).toBe("MIT");
    expect(screen.getByRole("button", { name: /Update/i })).toBeInTheDocument();
  });

  it("ignores load errors and still renders the empty form", async () => {
    mockGet.mockRejectedValue(new Error("load failed"));
    render(<CfpPage />);
    await waitFor(() =>
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /Submit Paper/i })).toBeDisabled();
  });

  it("submits successfully and shows the Submission Received screen", async () => {
    render(<CfpPage />);
    await waitFor(() =>
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument()
    );

    // Fill required, abstract long enough to be in range.
    const abstract = Array.from({ length: 1800 }, () => "word").join(" ");
    fireEvent.change(document.getElementById("abstract")!, {
      target: { name: "abstract", value: abstract },
    });
    fireEvent.change(document.getElementById("school")!, {
      target: { name: "school", value: "MIT" },
    });
    fireEvent.change(document.getElementById("department")!, {
      target: { name: "department", value: "EECS" },
    });
    fireEvent.change(document.getElementById("advisor")!, {
      target: { name: "advisor", value: "Prof X" },
    });
    fireEvent.change(document.getElementById("thesisTitle")!, {
      target: { name: "thesisTitle", value: "Fairness in ML" },
    });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Submit Paper/i })
      ).not.toBeDisabled()
    );

    const form = screen
      .getByRole("button", { name: /Submit Paper/i })
      .closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    expect(
      await screen.findByText(/Submission Received/i)
    ).toBeInTheDocument();

    // Edit Submission button returns to the form
    fireEvent.click(screen.getByRole("button", { name: /Edit Submission/i }));
    await waitFor(() =>
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument()
    );
  });

  it("shows inline error when submitCfpProposal throws an Error", async () => {
    mockSubmit.mockRejectedValue(new Error("server boom"));
    render(<CfpPage />);
    await waitFor(() =>
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument()
    );

    const abstract = Array.from({ length: 1800 }, () => "word").join(" ");
    fireEvent.change(document.getElementById("abstract")!, {
      target: { name: "abstract", value: abstract },
    });
    fireEvent.change(document.getElementById("school")!, {
      target: { name: "school", value: "MIT" },
    });
    fireEvent.change(document.getElementById("department")!, {
      target: { name: "department", value: "EECS" },
    });
    fireEvent.change(document.getElementById("advisor")!, {
      target: { name: "advisor", value: "Prof X" },
    });
    fireEvent.change(document.getElementById("thesisTitle")!, {
      target: { name: "thesisTitle", value: "Fairness in ML" },
    });

    const form = screen
      .getByRole("button", { name: /Submit Paper/i })
      .closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });
    await waitFor(() =>
      expect(screen.getByText(/server boom/i)).toBeInTheDocument()
    );
  });

  it("falls back to generic error when submit rejects with a non-Error", async () => {
    mockSubmit.mockRejectedValue("plain string");
    render(<CfpPage />);
    await waitFor(() =>
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument()
    );

    const abstract = Array.from({ length: 1800 }, () => "word").join(" ");
    fireEvent.change(document.getElementById("abstract")!, {
      target: { name: "abstract", value: abstract },
    });
    fireEvent.change(document.getElementById("school")!, {
      target: { name: "school", value: "MIT" },
    });
    fireEvent.change(document.getElementById("department")!, {
      target: { name: "department", value: "EECS" },
    });
    fireEvent.change(document.getElementById("advisor")!, {
      target: { name: "advisor", value: "Prof X" },
    });
    fireEvent.change(document.getElementById("thesisTitle")!, {
      target: { name: "thesisTitle", value: "Fairness in ML" },
    });

    const form = screen
      .getByRole("button", { name: /Submit Paper/i })
      .closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });
    await waitFor(() =>
      expect(screen.getByText(/Failed to submit\. Please try again\./i)).toBeInTheDocument()
    );
  });

  it("triggers the beforeunload handler when the abstract has unsaved content", async () => {
    render(<CfpPage />);
    await waitFor(() =>
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument()
    );
    fireEvent.change(document.getElementById("abstract")!, {
      target: { name: "abstract", value: "some draft text" },
    });

    const evt = new Event("beforeunload", { cancelable: true });
    Object.defineProperty(evt, "returnValue", {
      writable: true,
      value: "",
    });
    window.dispatchEvent(evt);
    // Just exercising the handler — preventDefault was called for coverage.
    expect(evt.defaultPrevented).toBe(true);
  });

  it("falls back to userProfile.displayName when user.displayName is missing", async () => {
    setAuth({
      user: {
        uid: "u3",
        email: "user@university.edu",
        getIdToken: jest.fn().mockResolvedValue("t"),
      },
      userProfile: { displayName: "Profile Name" },
    });
    render(<CfpPage />);
    await waitFor(() => {
      const nameInput = screen.getByLabelText(/Full Name/i) as HTMLInputElement;
      expect(nameInput.value).toBe("Profile Name");
    });
  });
});
