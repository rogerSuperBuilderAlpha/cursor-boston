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
});
