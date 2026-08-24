/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/AuthContext";
import { QuestionsListing } from "@/components/questions/QuestionsListing";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";
import type { Question } from "@/types/questions";

const mockUseAuth = useAuth as jest.Mock;

const question: Question = {
  id: "q1",
  title: "How do I test Cursor rules?",
  body: "I want a reliable pattern for testing agent guidance.",
  tags: ["testing", "cursor-rules"],
  authorId: "u2",
  authorName: "Questioner",
  authorPhoto: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  upCount: 2,
  downCount: 0,
  netScore: 2,
  answerCount: 1,
};

describe("QuestionsListing", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: makeAuthUser("u1") });
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/questions/vote") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            action: "added",
            type: "up",
            upCount: 3,
            downCount: 0,
            netScore: 3,
          }),
        };
      }
      if (url.startsWith("/api/questions/vote")) {
        return { ok: true, json: async () => ({ userVotes: {} }) };
      }
      if (url.startsWith("/api/questions")) {
        return {
          ok: true,
          json: async () => ({
            questions: [question],
            nextCursor: "next",
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;
  });

  it("renders questions, filters, loads more, and votes", async () => {
    render(<QuestionsListing />);

    await waitFor(() => {
      expect(screen.getByText(/How do I test Cursor rules/i)).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: /Upvote question/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: /Load More/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/questions/vote",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("renders the unfiltered empty state with ask CTA for signed-in users", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/questions/vote")) {
        return { ok: true, json: async () => ({ userVotes: {} }) };
      }
      if (url.startsWith("/api/questions")) {
        return { ok: true, json: async () => ({ questions: [], nextCursor: null }) };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;

    render(<QuestionsListing />);

    await waitFor(() => {
      expect(screen.getByText(/No questions yet/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Be the first to ask/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Ask a Question/i }),
    ).toHaveAttribute("href", "/questions/ask");
  });

  it("renders the filtered empty state with clear filter action", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/questions/vote")) {
        return { ok: true, json: async () => ({ userVotes: {} }) };
      }
      if (url.startsWith("/api/questions")) {
        return { ok: true, json: async () => ({ questions: [], nextCursor: null }) };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;

    render(<QuestionsListing />);

    await userEvent.type(
      screen.getByPlaceholderText(/Search questions/i),
      "missing topic",
    );

    await waitFor(() => {
      expect(screen.getByText(/No matches found/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/No results for 'missing topic'/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Clear filter/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search questions/i)).toHaveValue("");
    });
  });

  it("prompts signed-out users to sign in from the unfiltered empty state", async () => {
    mockUseAuth.mockReturnValue({ user: null });
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/questions")) {
        return { ok: true, json: async () => ({ questions: [], nextCursor: null }) };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;

    render(<QuestionsListing />);

    await waitFor(() => {
      expect(screen.getByText(/No questions yet/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /Sign in to ask/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
