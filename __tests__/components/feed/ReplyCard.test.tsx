import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Message } from "@/types/feed";
import { Timestamp } from "firebase/firestore";

jest.mock("@/lib/firebase", () => ({ db: null }));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill, priority, ...rest } = props;
    return <img data-fill={fill ? "true" : undefined} {...rest} />;
  },
}));

import { ReplyCard } from "@/components/feed/ReplyCard";

function makeReply(overrides: Partial<Message> = {}): Message {
  return {
    id: "reply-1",
    content: "Great point!",
    authorId: "user-2",
    authorName: "Bob",
    authorPhoto: null,
    createdAt: Timestamp.fromDate(new Date("2026-01-15")),
    likeCount: 3,
    dislikeCount: 1,
    ...overrides,
  };
}

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    reply: makeReply(),
    isOwner: false,
    userReaction: undefined,
    onLike: jest.fn(),
    onDislike: jest.fn(),
    onDelete: jest.fn(),
    isLoggedIn: true,
    ...overrides,
  };
}

describe("ReplyCard", () => {
  it("renders author name and content", () => {
    render(<ReplyCard {...defaultProps()} />);
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Great point!")).toBeInTheDocument();
  });

  it("renders initials when no author photo", () => {
    render(<ReplyCard {...defaultProps()} />);
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("renders author photo when provided", () => {
    render(<ReplyCard {...defaultProps({ reply: makeReply({ authorPhoto: "https://example.com/photo.jpg" }) })} />);
    expect(screen.getByRole("img", { name: "Bob" })).toBeInTheDocument();
  });

  it("renders like and dislike counts", () => {
    render(<ReplyCard {...defaultProps()} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("calls onLike when like button is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<ReplyCard {...props} />);
    await user.click(screen.getByRole("button", { name: "Like" }));
    expect(props.onLike).toHaveBeenCalledTimes(1);
  });

  it("calls onDislike when dislike button is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<ReplyCard {...props} />);
    await user.click(screen.getByRole("button", { name: "Dislike" }));
    expect(props.onDislike).toHaveBeenCalledTimes(1);
  });

  it("disables reaction buttons when not logged in", () => {
    render(<ReplyCard {...defaultProps({ isLoggedIn: false })} />);
    const likeBtn = screen.getByRole("button", { name: "Like" });
    const dislikeBtn = screen.getByRole("button", { name: "Dislike" });
    expect(likeBtn).toBeDisabled();
    expect(dislikeBtn).toBeDisabled();
  });

  it("shows delete confirm flow for owner", async () => {
    const user = userEvent.setup();
    const props = defaultProps({ isOwner: true });
    render(<ReplyCard {...props} />);

    await user.click(screen.getByRole("button", { name: /delete reply/i }));
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();

    await user.click(screen.getByText("Delete"));
    expect(props.onDelete).toHaveBeenCalledTimes(1);
  });

  it("cancels delete confirm flow", async () => {
    const user = userEvent.setup();
    const props = defaultProps({ isOwner: true });
    render(<ReplyCard {...props} />);

    await user.click(screen.getByRole("button", { name: /delete reply/i }));
    await user.click(screen.getByText("Cancel"));
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  it("does not show delete button for non-owners", () => {
    render(<ReplyCard {...defaultProps({ isOwner: false })} />);
    expect(screen.queryByRole("button", { name: /delete reply/i })).not.toBeInTheDocument();
  });
});
