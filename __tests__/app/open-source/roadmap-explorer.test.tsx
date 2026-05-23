/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { RoadmapExplorer } from "@/app/open-source/_components/RoadmapExplorer";

describe("RoadmapExplorer", () => {
  it("filters contribution ideas by category, difficulty, and search", () => {
    render(<RoadmapExplorer />);

    const status = screen.getByRole("status");
    const searchInput = screen.getByLabelText("Search roadmap ideas");

    expect(status).toHaveTextContent("Showing 22 of 22 roadmap ideas.");

    fireEvent.change(screen.getByLabelText("Filter by category"), {
      target: { value: "accessibility" },
    });
    fireEvent.change(screen.getByLabelText("Filter by difficulty"), {
      target: { value: "beginner" },
    });

    expect(screen.getByText("Keyboard Navigation Audit")).toBeInTheDocument();
    expect(screen.getByText("Color Contrast Check")).toBeInTheDocument();
    expect(screen.queryByText("Dark Mode Toggle")).not.toBeInTheDocument();
    expect(status).toHaveTextContent("Showing 2 of 22 roadmap ideas.");

    fireEvent.change(searchInput, {
      target: { value: "screen reader" },
    });

    expect(status).toHaveTextContent("No roadmap ideas match those filters.");
    expect(screen.getByText("No roadmap ideas match those filters.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByText("Dark Mode Toggle")).toBeInTheDocument();
    expect(status).toHaveTextContent("Showing 22 of 22 roadmap ideas.");
    expect(searchInput).toHaveFocus();
  });
});
