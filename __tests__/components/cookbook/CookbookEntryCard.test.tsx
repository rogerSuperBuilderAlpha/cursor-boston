import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CookbookEntry } from "@/types/cookbook";

jest.mock("@/components/cookbook/PromptMarkdown", () => ({
  PromptMarkdown: ({ content }: { content: string }) => <div data-testid="prompt-markdown">{content}</div>,
}));

jest.mock("@/lib/cookbook-labels", () => ({
  CATEGORY_LABELS: { debugging: "Debugging", refactoring: "Refactoring" },
}));

jest.mock("@/lib/format-cookbook-date", () => ({
  formatCookbookDate: (d: string) => d,
}));

import { CookbookEntryCard } from "@/components/cookbook/CookbookEntryCard";

function makeEntry(overrides: Partial<CookbookEntry> = {}): CookbookEntry {
  return {
    id: "entry-1",
    title: "Debug React Renders",
    description: "A prompt to help debug unnecessary React re-renders",
    promptContent: "Analyze this React component for unnecessary renders...",
    category: "debugging",
    tags: ["react", "performance"],
    worksWith: ["TypeScript", "React"],
    authorId: "u1",
    authorDisplayName: "Alice",
    createdAt: "2026-03-01",
    upCount: 5,
    downCount: 1,
    ...overrides,
  };
}

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    entry: makeEntry(),
    votes: { upCount: 5, downCount: 1 },
    userVote: undefined as string | undefined,
    isLoggedIn: true,
    isVoting: false,
    onVote: jest.fn(),
    onViewFull: jest.fn(),
    onTagClick: jest.fn(),
    ...overrides,
  };
}

describe("CookbookEntryCard", () => {
  it("renders entry title and description", () => {
    render(<CookbookEntryCard {...defaultProps()} />);
    expect(screen.getByRole("heading", { name: "Debug React Renders" })).toBeInTheDocument();
    expect(screen.getByText(/debug unnecessary React/)).toBeInTheDocument();
  });

  it("renders author name", () => {
    render(<CookbookEntryCard {...defaultProps()} />);
    expect(screen.getByText("by Alice")).toBeInTheDocument();
  });

  it("renders the prompt preview via PromptMarkdown", () => {
    render(<CookbookEntryCard {...defaultProps()} />);
    expect(screen.getByTestId("prompt-markdown")).toBeInTheDocument();
  });

  it("renders category label", () => {
    render(<CookbookEntryCard {...defaultProps()} />);
    expect(screen.getByText("Debugging")).toBeInTheDocument();
  });

  it("renders tags", () => {
    render(<CookbookEntryCard {...defaultProps()} />);
    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("performance")).toBeInTheDocument();
  });

  it("calls onTagClick when a tag is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<CookbookEntryCard {...props} />);
    await user.click(screen.getByRole("button", { name: /filter by tag: react/i }));
    expect(props.onTagClick).toHaveBeenCalledWith("react");
  });

  it("calls onViewFull when View full is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<CookbookEntryCard {...props} />);
    await user.click(screen.getByRole("button", { name: /view full prompt/i }));
    expect(props.onViewFull).toHaveBeenCalledWith(props.entry);
  });

  it("calls onVote with up when upvote is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<CookbookEntryCard {...props} />);
    await user.click(screen.getByRole("button", { name: /^upvote/i }));
    expect(props.onVote).toHaveBeenCalledWith("entry-1", "up");
  });

  it("calls onVote with down when downvote is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<CookbookEntryCard {...props} />);
    await user.click(screen.getByRole("button", { name: /^downvote/i }));
    expect(props.onVote).toHaveBeenCalledWith("entry-1", "down");
  });

  it("disables vote buttons when not logged in", () => {
    render(<CookbookEntryCard {...defaultProps({ isLoggedIn: false })} />);
    expect(screen.getByRole("button", { name: /^upvote/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^downvote/i })).toBeDisabled();
  });

  it("renders net score", () => {
    render(<CookbookEntryCard {...defaultProps()} />);
    expect(screen.getByText("+4")).toBeInTheDocument();
  });

  it("renders works-with tags", () => {
    render(<CookbookEntryCard {...defaultProps()} />);
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
  });
});
