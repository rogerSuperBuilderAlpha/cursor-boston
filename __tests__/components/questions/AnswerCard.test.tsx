import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnswerCard } from "@/components/questions/AnswerCard";
import type { Answer } from "@/types/questions";

const baseAnswer: Answer = {
  id: "a1",
  questionId: "q1",
  body: "You can create a .cursorrules file in your project root to define custom rules.",
  authorId: "u2",
  authorName: "Bob",
  authorPhoto: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  upCount: 3,
  downCount: 0,
  netScore: 3,
  isAccepted: false,
};

describe("AnswerCard", () => {
  const onVote = jest.fn();
  const onAccept = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it("renders the answer body", () => {
    render(
      <AnswerCard
        answer={baseAnswer}
        isLoggedIn
        isVoting={false}
        isQuestionAuthor={false}
        onVote={onVote}
        onAccept={onAccept}
      />
    );
    expect(screen.getByText(/\.cursorrules file/)).toBeInTheDocument();
  });

  it("shows net score", () => {
    render(
      <AnswerCard
        answer={baseAnswer}
        isLoggedIn
        isVoting={false}
        isQuestionAuthor={false}
        onVote={onVote}
        onAccept={onAccept}
      />
    );
    expect(screen.getByText("+3")).toBeInTheDocument();
  });

  it("shows author name", () => {
    render(
      <AnswerCard
        answer={baseAnswer}
        isLoggedIn
        isVoting={false}
        isQuestionAuthor={false}
        onVote={onVote}
        onAccept={onAccept}
      />
    );
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows accept button only for question author", () => {
    const { rerender } = render(
      <AnswerCard
        answer={baseAnswer}
        isLoggedIn
        isVoting={false}
        isQuestionAuthor={false}
        onVote={onVote}
        onAccept={onAccept}
      />
    );
    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();

    rerender(
      <AnswerCard
        answer={baseAnswer}
        isLoggedIn
        isVoting={false}
        isQuestionAuthor
        onVote={onVote}
        onAccept={onAccept}
      />
    );
    expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument();
  });

  it("shows accepted badge when isAccepted is true", () => {
    render(
      <AnswerCard
        answer={{ ...baseAnswer, isAccepted: true }}
        isLoggedIn
        isVoting={false}
        isQuestionAuthor={false}
        onVote={onVote}
        onAccept={onAccept}
      />
    );
    expect(screen.getByText("Accepted Answer")).toBeInTheDocument();
  });

  it("calls onAccept when accept button is clicked", () => {
    render(
      <AnswerCard
        answer={baseAnswer}
        isLoggedIn
        isVoting={false}
        isQuestionAuthor
        onVote={onVote}
        onAccept={onAccept}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /accept/i }));
    expect(onAccept).toHaveBeenCalledWith("a1");
  });
});
