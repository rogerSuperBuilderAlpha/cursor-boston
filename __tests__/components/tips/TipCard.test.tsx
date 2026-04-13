import { render, screen } from "@testing-library/react";
import { TipCard } from "@/components/tips/TipCard";
import type { WeeklyTip } from "@/types/tips";

function makeTip(overrides: Partial<WeeklyTip> = {}): WeeklyTip {
  return {
    id: "tip-1",
    title: "Use Cmd+K for inline edits",
    content: "Select any block of code and press Cmd+K to get AI-powered inline suggestions.",
    authorId: "u1",
    authorName: "Alice",
    category: "Keyboard Shortcuts",
    status: "published",
    createdAt: "2026-04-01T00:00:00Z",
    publishedAt: "2026-04-07T10:00:00Z",
    ...overrides,
  };
}

describe("TipCard", () => {
  it("renders tip title and content", () => {
    render(<TipCard tip={makeTip()} />);
    expect(screen.getByRole("heading", { name: /Cmd\+K/i })).toBeInTheDocument();
    expect(screen.getByText(/inline suggestions/)).toBeInTheDocument();
  });

  it("renders author name", () => {
    render(<TipCard tip={makeTip()} />);
    expect(screen.getByText("by Alice")).toBeInTheDocument();
  });

  it("renders formatted publish date", () => {
    render(<TipCard tip={makeTip()} />);
    expect(screen.getByText(/Apr 7, 2026/)).toBeInTheDocument();
  });

  it("renders category badge for non-General categories", () => {
    render(<TipCard tip={makeTip({ category: "Prompt Tricks" })} />);
    expect(screen.getByText("Prompt Tricks")).toBeInTheDocument();
  });

  it("does not render category badge for General", () => {
    render(<TipCard tip={makeTip({ category: "General" })} />);
    expect(screen.queryByText("General")).not.toBeInTheDocument();
  });

  it("does not render date when publishedAt is absent", () => {
    render(<TipCard tip={makeTip({ publishedAt: undefined })} />);
    expect(screen.queryByRole("time")).not.toBeInTheDocument();
  });
});
