import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User } from "firebase/auth";
import type { Message, ReactionType } from "@/types/feed";
import { Timestamp } from "firebase/firestore";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img data-fill={fill ? "true" : undefined} {...rest} />;
  },
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

jest.mock("@/lib/firebase", () => ({ db: null }));
jest.mock("@/components/skeletons/FeedMessageSkeleton", () => ({
  FeedMessageSkeleton: () => <div data-testid="feed-skeleton" />,
}));

const mockUseFeed = {
  loading: false,
  loadingMore: false,
  hasMore: false,
  loadMore: jest.fn(),
  error: null as string | null,
  clearError: jest.fn(),
  newMessage: "",
  setNewMessage: jest.fn(),
  posting: false,
  feedSearchQuery: "",
  setFeedSearchQuery: jest.fn(),
  filteredMessages: [] as Message[],
  userReactions: {} as Record<string, ReactionType>,
  expandedReplies: new Set<string>(),
  messageReplies: {} as Record<string, Message[]>,
  replyingTo: null as string | null,
  setReplyingTo: jest.fn(),
  replyContent: "",
  setReplyContent: jest.fn(),
  postingReply: false,
  repostingMessage: null as Message | null,
  setRepostingMessage: jest.fn(),
  repostComment: "",
  setRepostComment: jest.fn(),
  postMessage: jest.fn(),
  deleteMessage: jest.fn(),
  toggleReaction: jest.fn(),
  toggleReplies: jest.fn(),
  postReply: jest.fn(),
  repostMessage: jest.fn(),
};

jest.mock("@/hooks/useFeed", () => ({
  useFeed: jest.fn(() => mockUseFeed),
}));

import { CommunityFeed } from "@/components/feed/CommunityFeed";
import { useFeed } from "@/hooks/useFeed";

const mockedUseFeed = useFeed as jest.MockedFunction<typeof useFeed>;

function makeUser(overrides: Partial<User> = {}): User {
  return {
    uid: "user-1",
    displayName: "Alice Smith",
    email: "alice@example.com",
    photoURL: null,
    ...overrides,
  } as User;
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    content: "Test message content",
    authorId: "user-2",
    authorName: "Bob",
    authorPhoto: null,
    createdAt: Timestamp.fromDate(new Date("2026-01-01")),
    likeCount: 0,
    dislikeCount: 0,
    replyCount: 0,
    repostCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset to default state
  Object.assign(mockUseFeed, {
    loading: false,
    loadingMore: false,
    hasMore: false,
    error: null,
    newMessage: "",
    posting: false,
    feedSearchQuery: "",
    filteredMessages: [],
    userReactions: {},
    expandedReplies: new Set<string>(),
    messageReplies: {},
    replyingTo: null,
    replyContent: "",
    postingReply: false,
    repostingMessage: null,
    repostComment: "",
  });
  mockedUseFeed.mockReturnValue(mockUseFeed as ReturnType<typeof useFeed>);
});

describe("CommunityFeed", () => {
  const onViewMemberProfile = jest.fn();

  it("renders without crashing", () => {
    render(<CommunityFeed user={null} onViewMemberProfile={onViewMemberProfile} />);
    expect(screen.getByPlaceholderText("Search messages...")).toBeInTheDocument();
  });

  it("shows loading skeletons when loading", () => {
    mockUseFeed.loading = true;
    render(<CommunityFeed user={makeUser()} onViewMemberProfile={onViewMemberProfile} />);
    expect(screen.getAllByTestId("feed-skeleton")).toHaveLength(3);
  });

  it("shows empty state when no messages", () => {
    render(<CommunityFeed user={makeUser()} onViewMemberProfile={onViewMemberProfile} />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
    expect(screen.getByText("Be the first to post something!")).toBeInTheDocument();
  });

  it("shows sign-in prompt when no user", () => {
    render(<CommunityFeed user={null} onViewMemberProfile={onViewMemberProfile} />);
    expect(screen.getByText("Sign in to post messages")).toBeInTheDocument();
  });

  it("renders messages from feed", () => {
    mockUseFeed.filteredMessages = [
      makeMessage({ id: "m1", content: "First post" }),
      makeMessage({ id: "m2", content: "Second post" }),
    ];
    render(<CommunityFeed user={makeUser()} onViewMemberProfile={onViewMemberProfile} />);
    expect(screen.getByText("First post")).toBeInTheDocument();
    expect(screen.getByText("Second post")).toBeInTheDocument();
  });

  it("shows error state and dismiss button", async () => {
    const user = userEvent.setup();
    mockUseFeed.error = "Something went wrong";
    render(<CommunityFeed user={makeUser()} onViewMemberProfile={onViewMemberProfile} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    await user.click(screen.getByText("Dismiss"));
    expect(mockUseFeed.clearError).toHaveBeenCalledTimes(1);
  });

  it("shows search results count when searching", () => {
    mockUseFeed.feedSearchQuery = "hello";
    mockUseFeed.filteredMessages = [makeMessage()];
    render(<CommunityFeed user={makeUser()} onViewMemberProfile={onViewMemberProfile} />);
    expect(screen.getByText(/1 result for/)).toBeInTheDocument();
  });

  it("shows no-search-results empty state", () => {
    mockUseFeed.feedSearchQuery = "nonexistent";
    mockUseFeed.filteredMessages = [];
    render(<CommunityFeed user={makeUser()} onViewMemberProfile={onViewMemberProfile} />);
    expect(screen.getByText("No messages match your search")).toBeInTheDocument();
  });

  it("shows load more button when hasMore", () => {
    mockUseFeed.hasMore = true;
    mockUseFeed.filteredMessages = [makeMessage()];
    render(<CommunityFeed user={makeUser()} onViewMemberProfile={onViewMemberProfile} />);
    expect(screen.getByText("Load more")).toBeInTheDocument();
  });

  it("calls loadMore when button clicked", async () => {
    const user = userEvent.setup();
    mockUseFeed.hasMore = true;
    mockUseFeed.filteredMessages = [makeMessage()];
    render(<CommunityFeed user={makeUser()} onViewMemberProfile={onViewMemberProfile} />);

    await user.click(screen.getByText("Load more"));
    expect(mockUseFeed.loadMore).toHaveBeenCalledTimes(1);
  });

  it("shows Loading... when loadingMore", () => {
    mockUseFeed.hasMore = true;
    mockUseFeed.loadingMore = true;
    mockUseFeed.filteredMessages = [makeMessage()];
    render(<CommunityFeed user={makeUser()} onViewMemberProfile={onViewMemberProfile} />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("hides load more when searching", () => {
    mockUseFeed.hasMore = true;
    mockUseFeed.feedSearchQuery = "test";
    mockUseFeed.filteredMessages = [makeMessage()];
    render(<CommunityFeed user={makeUser()} onViewMemberProfile={onViewMemberProfile} />);
    expect(screen.queryByText("Load more")).not.toBeInTheDocument();
  });

  it("shows clear search button when search has value", () => {
    mockUseFeed.feedSearchQuery = "test";
    render(<CommunityFeed user={makeUser()} onViewMemberProfile={onViewMemberProfile} />);
    expect(screen.getByLabelText("Clear search")).toBeInTheDocument();
  });

  it("renders repost modal when repostingMessage is set", () => {
    mockUseFeed.repostingMessage = makeMessage();
    render(<CommunityFeed user={makeUser()} onViewMemberProfile={onViewMemberProfile} />);
    expect(screen.getByText("Repost with comment")).toBeInTheDocument();
  });
});
