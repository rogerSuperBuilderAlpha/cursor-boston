/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionsListing } from "@/components/questions/QuestionsListing";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a {...props}>{children}</a>,
}));

const mockUseAuth = jest.fn(() => ({ user: null }));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const originalFetch = globalThis.fetch;
let mockFetch: jest.Mock;

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: null });
  mockFetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ questions: [], nextCursor: null }),
    } as Response)
  );
  globalThis.fetch = mockFetch as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe("QuestionsListing", () => {
  it("shows an unfiltered empty state with an ask question CTA for signed-out users", async () => {
    render(<QuestionsListing />);

    expect(await screen.findByText("No questions yet.")).toBeInTheDocument();
    expect(screen.getByText("Be the first to ask!")).toBeInTheDocument();

    const askLink = screen.getByRole("link", { name: /ask a question/i });
    expect(askLink).toHaveAttribute("href", "/questions/ask");
  });

  it("shows a filtered empty state and clears the active tag filter", async () => {
    const user = userEvent.setup();
    render(<QuestionsListing />);

    expect(await screen.findByText("No questions yet.")).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Agents" }));
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith(expect.stringContaining("tag=agents"));
    });
    expect(await screen.findByRole("heading", { name: "No matches found" })).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Clear filter?" }));
    });

    await waitFor(() => {
      const lastUrl = mockFetch.mock.calls.at(-1)?.[0] as string;
      expect(lastUrl).not.toContain("tag=agents");
    });
    expect(await screen.findByText("No questions yet.")).toBeInTheDocument();
  });
});
