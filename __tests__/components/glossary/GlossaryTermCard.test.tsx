import { render, screen } from "@testing-library/react";
import { GlossaryTermCard } from "@/components/glossary/GlossaryTermCard";
import type { GlossaryTerm } from "@/types/glossary";

function makeTerm(overrides: Partial<GlossaryTerm> = {}): GlossaryTerm {
  return {
    id: "test-term",
    term: "Copilot++",
    slug: "copilot-plus-plus",
    definition: "An advanced AI pair programming feature in Cursor that predicts your next edit.",
    category: "Cursor Features",
    status: "approved",
    createdBy: { uid: "u1", name: "Alice" },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("GlossaryTermCard", () => {
  it("renders the term title", () => {
    render(<GlossaryTermCard term={makeTerm()} />);
    expect(screen.getByRole("heading", { name: "Copilot++" })).toBeInTheDocument();
  });

  it("renders the definition text", () => {
    render(<GlossaryTermCard term={makeTerm()} />);
    expect(screen.getByText(/advanced AI pair programming/)).toBeInTheDocument();
  });

  it("links to the glossary slug page", () => {
    render(<GlossaryTermCard term={makeTerm()} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/glossary/copilot-plus-plus");
  });

  it("renders the category when present", () => {
    render(<GlossaryTermCard term={makeTerm({ category: "AI Concepts" })} />);
    expect(screen.getByText("AI Concepts")).toBeInTheDocument();
  });

  it("does not render a category badge when category is absent", () => {
    render(<GlossaryTermCard term={makeTerm({ category: undefined })} />);
    expect(screen.queryByText("Cursor Features")).not.toBeInTheDocument();
  });
});
