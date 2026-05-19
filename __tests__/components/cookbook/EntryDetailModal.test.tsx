import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CookbookEntry } from "@/types/cookbook";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

jest.mock("@/components/cookbook/PromptMarkdown", () => ({
  PromptMarkdown: ({ content }: { content: string }) => (
    <div data-testid="prompt-markdown">{content}</div>
  ),
}));

jest.mock("@/lib/cookbook-labels", () => ({
  CATEGORY_LABELS: { debugging: "Debugging", other: "Other" },
}));

jest.mock("@/lib/format-cookbook-date", () => ({
  formatCookbookDate: (d: string) => d,
}));

import { EntryDetailModal } from "@/components/cookbook/EntryDetailModal";

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
    onClose: jest.fn(),
    ...overrides,
  };
}

describe("EntryDetailModal", () => {
  let writeText: jest.Mock;

  beforeEach(() => {
    writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
  });

  it("renders entry title, description, and prompt content", () => {
    render(<EntryDetailModal {...defaultProps()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Debug React Renders" })).toBeInTheDocument();
    expect(screen.getByText(/debug unnecessary React/)).toBeInTheDocument();
    expect(screen.getByTestId("prompt-markdown")).toHaveTextContent(
      "Analyze this React component for unnecessary renders...",
    );
  });

  it("renders category, tags, and works-with metadata", () => {
    render(<EntryDetailModal {...defaultProps()} />);
    expect(screen.getByText("Debugging")).toBeInTheDocument();
    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("performance")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
  });

  it("renders author link and created date", () => {
    render(<EntryDetailModal {...defaultProps()} />);
    expect(screen.getByRole("link", { name: "by Alice" })).toHaveAttribute(
      "href",
      "/members?search=Alice",
    );
    expect(screen.getByText("2026-03-01")).toBeInTheDocument();
  });

  it("copies prompt content when Copy is clicked", async () => {
    render(<EntryDetailModal {...defaultProps()} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "Analyze this React component for unnecessary renders...",
      );
    });
    expect(await screen.findByRole("button", { name: "Copied!" })).toBeInTheDocument();
  });

  it("calls onVote for up and down actions", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<EntryDetailModal {...props} />);

    await user.click(screen.getByRole("button", { name: /^Upvote Debug React Renders/i }));
    expect(props.onVote).toHaveBeenCalledWith("entry-1", "up");

    await user.click(screen.getByRole("button", { name: /^Downvote Debug React Renders/i }));
    expect(props.onVote).toHaveBeenCalledWith("entry-1", "down");
  });

  it("disables vote buttons when not logged in", () => {
    render(<EntryDetailModal {...defaultProps({ isLoggedIn: false })} />);
    expect(screen.getByRole("button", { name: /^Upvote/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Downvote/i })).toBeDisabled();
  });

  it("renders net score", () => {
    render(<EntryDetailModal {...defaultProps()} />);
    expect(screen.getByText("+4")).toBeInTheDocument();
  });

  it("calls onClose when Close button is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<EntryDetailModal {...props} />);

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", () => {
    const props = defaultProps();
    render(<EntryDetailModal {...props} />);

    fireEvent.click(screen.getByRole("dialog"));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed", () => {
    const props = defaultProps();
    render(<EntryDetailModal {...props} />);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
