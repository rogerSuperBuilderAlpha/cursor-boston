import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestionCard } from "@/components/questions/QuestionCard";
import type { Question } from "@/types/questions";

const baseQuestion: Question = {
  id: "q1",
  title: "How do I configure Cursor rules?",
  body: "I want to set up custom rules for my project but can't find the right config.",
  tags: ["cursor-rules", "workflows"],
  authorId: "u1",
  authorName: "Alice",
  authorPhoto: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  upCount: 5,
  downCount: 1,
  netScore: 4,
  answerCount: 3,
};

describe("QuestionCard", () => {
  const onVote = jest.fn();
  const onTagClick = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it("renders title and body preview", () => {
    render(
      <QuestionCard
        question={baseQuestion}
        isLoggedIn
        isVoting={false}
        onVote={onVote}
        onTagClick={onTagClick}
      />
    );
    expect(screen.getByText("How do I configure Cursor rules?")).toBeInTheDocument();
    expect(screen.getByText(/custom rules/)).toBeInTheDocument();
  });

  it("shows net score with correct sign", () => {
    render(
      <QuestionCard
        question={baseQuestion}
        isLoggedIn
        isVoting={false}
        onVote={onVote}
      />
    );
    expect(screen.getByText("+4")).toBeInTheDocument();
  });

  it("renders tags as clickable buttons", () => {
    render(
      <QuestionCard
        question={baseQuestion}
        isLoggedIn
        isVoting={false}
        onVote={onVote}
        onTagClick={onTagClick}
      />
    );
    const tagBtn = screen.getByText("cursor-rules");
    fireEvent.click(tagBtn);
    expect(onTagClick).toHaveBeenCalledWith("cursor-rules");
  });

  it("displays answer count", () => {
    render(
      <QuestionCard
        question={baseQuestion}
        isLoggedIn
        isVoting={false}
        onVote={onVote}
      />
    );
    expect(screen.getByText("3 answers")).toBeInTheDocument();
  });

  it("displays author name", () => {
    render(
      <QuestionCard
        question={baseQuestion}
        isLoggedIn
        isVoting={false}
        onVote={onVote}
      />
    );
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });

  it("disables vote buttons when not logged in", () => {
    render(
      <QuestionCard
        question={baseQuestion}
        isLoggedIn={false}
        isVoting={false}
        onVote={onVote}
      />
    );
    const upBtn = screen.getByRole("button", { name: /upvote/i });
    expect(upBtn).toBeDisabled();
  });

  it("calls onVote when upvote is clicked", () => {
    render(
      <QuestionCard
        question={baseQuestion}
        isLoggedIn
        isVoting={false}
        onVote={onVote}
      />
    );
    const upBtn = screen.getByRole("button", { name: /upvote/i });
    fireEvent.click(upBtn);
    expect(onVote).toHaveBeenCalledWith("q1", "up");
  });
});
