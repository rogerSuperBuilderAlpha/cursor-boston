/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { QuestionDetail } from "@/components/questions/QuestionDetail";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";
import type { Answer, Question } from "@/types/questions";

const mockUseAuth = useAuth as jest.Mock;

const question: Question = {
  id: "q1",
  title: "How should I structure test helpers?",
  body: "I have several app page tests that need shared setup.",
  tags: ["testing"],
  authorId: "u1",
  authorName: "Author",
  authorPhoto: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  upCount: 4,
  downCount: 1,
  netScore: 3,
  answerCount: 1,
};

const answer: Answer = {
  id: "a1",
  questionId: "q1",
  body: "Keep the helpers small and near the tests.",
  authorId: "u2",
  authorName: "Responder",
  authorPhoto: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  upCount: 1,
  downCount: 0,
  netScore: 1,
  isAccepted: false,
};

describe("QuestionDetail", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: makeAuthUser("u1") });
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/questions/vote" && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            action: "added",
            type: "up",
            upCount: 5,
            downCount: 1,
            netScore: 4,
          }),
        };
      }
      if (url === "/api/questions/vote") {
        return { ok: true, json: async () => ({ userVotes: {} }) };
      }
      if (url === "/api/questions/accept") {
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url === "/api/questions/answer") {
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url === "/api/questions/q1") {
        return {
          ok: true,
          json: async () => ({
            question: { ...question, answerCount: 2 },
            answers: [{ ...answer }, { ...answer, id: "a2", body: "Posted answer" }],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;
  });

  it("renders answers, accepts one, votes, and posts an answer", async () => {
    render(
      <QuestionDetail
        questionId="q1"
        initialQuestion={question}
        initialAnswers={[answer]}
        initialRelatedCookbook={[
          {
            id: "cook-1",
            title: "Testing guide",
            description: "Practical test helper advice.",
            tags: ["testing"],
          } as never,
        ]}
      />,
    );

    expect(screen.getByText(/How should I structure test helpers/i)).toBeInTheDocument();
    expect(screen.getByText(/Responder/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Accept this answer/i }));
    fireEvent.click(screen.getByRole("button", { name: /Upvote question/i }));
    fireEvent.change(
      screen.getByPlaceholderText(/Share your knowledge/i),
      { target: { value: "This is a sufficiently detailed answer body." } },
    );
    fireEvent.click(screen.getByRole("button", { name: /Post Answer/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/questions/answer",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
