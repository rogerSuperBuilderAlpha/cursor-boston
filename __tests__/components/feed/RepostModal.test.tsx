import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Message } from "@/types/feed";
import { Timestamp } from "firebase/firestore";

jest.mock("@/lib/firebase", () => ({ db: null }));

import { RepostModal } from "@/components/feed/RepostModal";

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    content: "Original post content",
    authorId: "user-1",
    authorName: "Alice",
    authorPhoto: null,
    createdAt: Timestamp.fromDate(new Date("2026-01-01")),
    ...overrides,
  };
}

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    message: makeMessage(),
    comment: "",
    onCommentChange: jest.fn(),
    onSubmit: jest.fn(),
    onCancel: jest.fn(),
    posting: false,
    ...overrides,
  };
}

describe("RepostModal", () => {
  it("renders without crashing", () => {
    render(<RepostModal {...defaultProps()} />);
    expect(screen.getByText("Repost with comment")).toBeInTheDocument();
  });

  it("displays original message content and author", () => {
    render(<RepostModal {...defaultProps()} />);
    expect(screen.getByText("Original post content")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("has dialog role and aria-modal", () => {
    render(<RepostModal {...defaultProps()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("shows character count", () => {
    render(<RepostModal {...defaultProps({ comment: "Hello" })} />);
    expect(screen.getByText("5/500 (minimum 100)")).toBeInTheDocument();
  });

  it("disables repost when comment is too short", () => {
    render(<RepostModal {...defaultProps({ comment: "short" })} />);
    expect(screen.getByText("Repost")).toBeDisabled();
  });

  it("enables repost when comment meets minimum length", () => {
    const longComment = "a".repeat(100);
    render(<RepostModal {...defaultProps({ comment: longComment })} />);
    expect(screen.getByText("Repost")).not.toBeDisabled();
  });

  it("disables repost while posting", () => {
    const longComment = "a".repeat(100);
    render(<RepostModal {...defaultProps({ comment: longComment, posting: true })} />);
    expect(screen.getByText("Reposting...")).toBeDisabled();
  });

  it("calls onSubmit when repost clicked", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    const longComment = "a".repeat(100);
    render(<RepostModal {...defaultProps({ comment: longComment, onSubmit })} />);

    await user.click(screen.getByText("Repost"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel clicked", async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    render(<RepostModal {...defaultProps({ onCancel })} />);

    await user.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel on Escape key", async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    render(<RepostModal {...defaultProps({ onCancel })} />);

    // Focus the textarea inside the modal so the keyDown event bubbles to the dialog
    const textarea = screen.getByPlaceholderText("Add your comment...");
    await user.click(textarea);
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCommentChange when typing", async () => {
    const user = userEvent.setup();
    const onCommentChange = jest.fn();
    render(<RepostModal {...defaultProps({ onCommentChange })} />);

    await user.type(screen.getByPlaceholderText("Add your comment..."), "a");
    expect(onCommentChange).toHaveBeenCalled();
  });

  it("uses custom minLength and maxLength", () => {
    render(
      <RepostModal
        {...defaultProps({ comment: "test", minLength: 5, maxLength: 200 })}
      />,
    );
    expect(screen.getByText("4/200 (minimum 5)")).toBeInTheDocument();
  });
});
