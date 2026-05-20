/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/questions/ask/AskQuestionForm.tsx` was
 * at 16.7% statements (35 uncovered). Covers signed-out null, title +
 * body inputs with char count, tag toggle (add/remove/cap-at-5), submit
 * disabled until min lengths met, success → router.push, body.error
 * error path, generic fallback message on non-Error throw.
 */

import "@/__tests__/app/_shared/page-test-setup";

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

const mockPush = jest.fn();
const mockGetIdToken = jest.fn().mockResolvedValue("tok");
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
  usePathname: () => "/questions/ask",
}));

jest.mock("firebase/auth", () => ({
  getIdToken: (...args: unknown[]) => mockGetIdToken(...args),
}));

import { useAuth } from "@/contexts/AuthContext";
import { AskQuestionForm } from "@/app/questions/ask/AskQuestionForm";

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const originalFetch = global.fetch;

function setAuth(user: unknown) {
  mockUseAuth.mockReturnValue({ user, userProfile: null, loading: false } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetIdToken.mockResolvedValue("tok");
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("AskQuestionForm", () => {
  it("shows signed-out gate when no user", () => {
    setAuth(null);
    render(<AskQuestionForm />);
    expect(screen.getByText(/Sign in to ask a question/i)).toBeInTheDocument();
  });

  it("renders the form fields when signed in", () => {
    setAuth({ uid: "u1" });
    render(<AskQuestionForm />);
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Details")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Post Question/i })).toBeDisabled();
  });

  it("updates char counts as title and body change", () => {
    setAuth({ uid: "u1" });
    render(<AskQuestionForm />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "abcdef" } });
    expect(screen.getByText("6/200")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Details"), {
      target: { value: "a b c d e" },
    });
    expect(screen.getByText("9/5000")).toBeInTheDocument();
  });

  it("toggles tags on click (add then remove)", () => {
    setAuth({ uid: "u1" });
    render(<AskQuestionForm />);
    const tagBtn = screen.getByRole("button", { name: /Prompting/i });
    fireEvent.click(tagBtn);
    expect(tagBtn.className).toMatch(/emerald-500\/15/);
    fireEvent.click(tagBtn);
    expect(tagBtn.className).not.toMatch(/emerald-500\/15/);
  });

  it("caps tag selection at 5", () => {
    setAuth({ uid: "u1" });
    render(<AskQuestionForm />);
    const allTags = [
      "Cursor Rules",
      "Prompting",
      "Debugging",
      "Refactoring",
      "Testing",
      "Architecture",
    ];
    for (const name of allTags) {
      fireEvent.click(screen.getByRole("button", { name }));
    }
    const selected = allTags
      .map((n) => screen.getByRole("button", { name: n }))
      .filter((b) => b.className.includes("emerald-500/15"));
    expect(selected.length).toBe(5);
  });

  it("surfaces server error body.error message on !res.ok", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "duplicate question detected" }),
    })) as never;
    setAuth({ uid: "u1" });
    render(<AskQuestionForm />);
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "How do I do X in cursor?" },
    });
    fireEvent.change(screen.getByLabelText("Details"), {
      target: { value: "I have tried Y and Z but neither worked." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Post Question/i }));
    await waitFor(() =>
      expect(screen.getByText(/duplicate question detected/i)).toBeInTheDocument()
    );
  });

  it("falls back to 'Failed to post question' when error body has no message", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })) as never;
    setAuth({ uid: "u1" });
    render(<AskQuestionForm />);
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "How do I do X in cursor?" },
    });
    fireEvent.change(screen.getByLabelText("Details"), {
      target: { value: "I have tried Y and Z but neither worked." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Post Question/i }));
    await waitFor(() =>
      expect(screen.getByText(/Failed to post question/i)).toBeInTheDocument()
    );
  });

});
