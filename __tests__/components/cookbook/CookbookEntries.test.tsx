import { render, screen } from "@testing-library/react";
import type { CookbookEntry } from "@/types/cookbook";

jest.mock("@/components/cookbook/CookbookEntryCard", () => ({
  CookbookEntryCard: ({ entry }: { entry: CookbookEntry }) => (
    <div data-testid={`entry-${entry.id}`}>{entry.title}</div>
  ),
}));

import { CookbookEntries } from "@/components/cookbook/CookbookEntries";

function makeEntry(id: string, title: string): CookbookEntry {
  return {
    id,
    title,
    description: "A test entry",
    promptContent: "Do something",
    category: "debugging",
    tags: [],
    worksWith: [],
    authorId: "u1",
    authorDisplayName: "Alice",
    createdAt: "2026-01-01",
    upCount: 0,
    downCount: 0,
  };
}

describe("CookbookEntries", () => {
  const baseProps = {
    voteState: {} as Record<string, { upCount: number; downCount: number; userVote?: "up" | "down" }>,
    isLoggedIn: true,
    votingId: null,
    onVote: jest.fn(),
    onViewFull: jest.fn(),
    onTagClick: jest.fn(),
  };

  it("renders the correct number of entry cards", () => {
    const entries = [makeEntry("1", "Entry 1"), makeEntry("2", "Entry 2"), makeEntry("3", "Entry 3")];
    render(<CookbookEntries entries={entries} {...baseProps} />);
    expect(screen.getAllByTestId(/^entry-/)).toHaveLength(3);
  });

  it("renders nothing when entries array is empty", () => {
    const { container } = render(<CookbookEntries entries={[]} {...baseProps} />);
    expect(container.querySelector("[data-testid]")).toBeNull();
  });

  it("renders each entry title via the card component", () => {
    const entries = [makeEntry("a", "Debug Helper"), makeEntry("b", "Refactor Guide")];
    render(<CookbookEntries entries={entries} {...baseProps} />);
    expect(screen.getByText("Debug Helper")).toBeInTheDocument();
    expect(screen.getByText("Refactor Guide")).toBeInTheDocument();
  });
});
