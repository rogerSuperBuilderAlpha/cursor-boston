import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Message } from "@/types/feed";
import { Timestamp } from "firebase/firestore";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img data-fill={fill ? "true" : undefined} {...rest} />;
  },
}));

jest.mock("@/lib/firebase", () => ({ db: null }));
jest.mock("@/components/feed/ReplyCard", () => ({
  ReplyCard: (props: Record<string, unknown>) => (
    <div data-testid={`reply-${props.reply && (props.reply as { id: string }).id}`} />
  ),
}));

import { MessageCard } from "@/components/feed/MessageCard";

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    content: "Hello world",
    authorId: "user-1",
    authorName: "Alice",
    authorPhoto: null,
    createdAt: Timestamp.fromDate(new Date("2026-01-01")),
    likeCount: 3,
    dislikeCount: 1,
    replyCount: 0,
    repostCount: 2,
    ...overrides,
  };
}

const noop = () => {};

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    message: makeMessage(),
    isOwner: false,
    isLoggedIn: true,
    userReaction: undefined,
    onDelete: jest.fn(),
    onAuthorClick: jest.fn(),
    onLike: jest.fn(),
    onDislike: jest.fn(),
    onReply: jest.fn(),
    onRepost: jest.fn(),
    showReplyInput: false,
    replyContent: "",
    onReplyContentChange: jest.fn(),
    onSubmitReply: jest.fn(),
    postingReply: false,
    replies: [] as Message[],
    showReplies: false,
    onToggleReplies: jest.fn(),
    onReplyLike: jest.fn(),
    onReplyDislike: jest.fn(),
    onDeleteReply: jest.fn(),
    replyReactions: {},
    currentUserId: "user-2",
    ...overrides,
  };
}

describe("MessageCard", () => {
  it("renders without crashing", () => {
    render(<MessageCard {...defaultProps()} />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("displays author name and content", () => {
    render(<MessageCard {...defaultProps()} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("shows initials when no author photo", () => {
    render(<MessageCard {...defaultProps()} />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("shows author photo when provided", () => {
    const msg = makeMessage({ authorPhoto: "https://example.com/photo.jpg" });
    render(<MessageCard {...defaultProps({ message: msg })} />);
    const img = screen.getByAltText("Alice");
    expect(img).toHaveAttribute("src", "https://example.com/photo.jpg");
  });

  it("displays reaction counts", () => {
    render(<MessageCard {...defaultProps()} />);
    expect(screen.getByText("3")).toBeInTheDocument(); // likes
    expect(screen.getByText("1")).toBeInTheDocument(); // dislikes
  });

  it("shows repost button for non-repost messages", () => {
    render(<MessageCard {...defaultProps()} />);
    expect(screen.getByLabelText("Repost")).toBeInTheDocument();
  });

  it("hides repost button for repost messages", () => {
    const msg = makeMessage({
      repostOf: {
        originalId: "orig-1",
        originalAuthorId: "user-3",
        originalAuthorName: "Bob",
        originalContent: "Original post",
      },
    });
    render(<MessageCard {...defaultProps({ message: msg })} />);
    expect(screen.queryByLabelText("Repost")).not.toBeInTheDocument();
  });

  it("shows repost header for reposted messages", () => {
    const msg = makeMessage({
      repostOf: {
        originalId: "orig-1",
        originalAuthorId: "user-3",
        originalAuthorName: "Bob",
        originalContent: "Original post",
      },
    });
    render(<MessageCard {...defaultProps({ message: msg })} />);
    expect(screen.getByText("reposted")).toBeInTheDocument();
    expect(screen.getByText("Original post")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows delete button only for owner", () => {
    const { rerender } = render(<MessageCard {...defaultProps({ isOwner: false })} />);
    expect(screen.queryByLabelText("Delete message")).not.toBeInTheDocument();

    rerender(<MessageCard {...defaultProps({ isOwner: true })} />);
    expect(screen.getByLabelText("Delete message")).toBeInTheDocument();
  });

  it("shows delete confirmation on click", async () => {
    const user = userEvent.setup();
    render(<MessageCard {...defaultProps({ isOwner: true })} />);

    await user.click(screen.getByLabelText("Delete message"));
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onDelete when confirmed", async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    render(<MessageCard {...defaultProps({ isOwner: true, onDelete })} />);

    await user.click(screen.getByLabelText("Delete message"));
    await user.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("cancels delete confirmation", async () => {
    const user = userEvent.setup();
    render(<MessageCard {...defaultProps({ isOwner: true })} />);

    await user.click(screen.getByLabelText("Delete message"));
    await user.click(screen.getByText("Cancel"));
    // Back to the three-dot menu
    expect(screen.getByLabelText("Delete message")).toBeInTheDocument();
  });

  it("calls onLike and onDislike", async () => {
    const user = userEvent.setup();
    const onLike = jest.fn();
    const onDislike = jest.fn();
    render(<MessageCard {...defaultProps({ onLike, onDislike })} />);

    await user.click(screen.getByLabelText("Like"));
    expect(onLike).toHaveBeenCalledTimes(1);

    await user.click(screen.getByLabelText("Dislike"));
    expect(onDislike).toHaveBeenCalledTimes(1);
  });

  it("disables reaction buttons when not logged in", () => {
    render(<MessageCard {...defaultProps({ isLoggedIn: false })} />);
    expect(screen.getByLabelText("Like")).toBeDisabled();
    expect(screen.getByLabelText("Dislike")).toBeDisabled();
    expect(screen.getByLabelText("Reply")).toBeDisabled();
  });

  it("calls onAuthorClick when author name clicked", async () => {
    const user = userEvent.setup();
    const onAuthorClick = jest.fn();
    render(<MessageCard {...defaultProps({ onAuthorClick })} />);

    const profileButtons = screen.getAllByLabelText("View Alice's profile");
    await user.click(profileButtons[0]);
    expect(onAuthorClick).toHaveBeenCalled();
  });

  it("shows reply input when showReplyInput is true", () => {
    render(
      <MessageCard
        {...defaultProps({
          showReplyInput: true,
          replyContent: "",
        })}
      />,
    );
    expect(screen.getByLabelText("Reply to Alice")).toBeInTheDocument();
  });

  it("hides reply input when showReplyInput is false", () => {
    render(<MessageCard {...defaultProps({ showReplyInput: false })} />);
    expect(screen.queryByLabelText("Reply to Alice")).not.toBeInTheDocument();
  });

  it("disables reply submit when content too short", () => {
    render(
      <MessageCard
        {...defaultProps({
          showReplyInput: true,
          replyContent: "short",
        })}
      />,
    );
    // Find the submit button by its text "Reply" inside the reply input area
    const buttons = screen.getAllByText("Reply");
    // Last "Reply" text is the submit button inside the reply form
    const submitButton = buttons[buttons.length - 1].closest("button");
    expect(submitButton).toBeDisabled();
  });

  it("shows view replies toggle when replyCount > 0", () => {
    const msg = makeMessage({ replyCount: 5 });
    render(<MessageCard {...defaultProps({ message: msg })} />);
    expect(screen.getByText(/View 5 replies/)).toBeInTheDocument();
  });

  it("shows hide replies when expanded", () => {
    const msg = makeMessage({ replyCount: 2 });
    render(
      <MessageCard
        {...defaultProps({
          message: msg,
          showReplies: true,
          replies: [
            makeMessage({ id: "reply-1", content: "Reply 1" }),
            makeMessage({ id: "reply-2", content: "Reply 2" }),
          ],
        })}
      />,
    );
    expect(screen.getByText(/Hide 2 replies/)).toBeInTheDocument();
  });

  it("shows active like state", () => {
    render(<MessageCard {...defaultProps({ userReaction: "like" as const })} />);
    expect(screen.getByLabelText("Remove like")).toBeInTheDocument();
  });

  it("shows active dislike state", () => {
    render(<MessageCard {...defaultProps({ userReaction: "dislike" as const })} />);
    expect(screen.getByLabelText("Remove dislike")).toBeInTheDocument();
  });
});
