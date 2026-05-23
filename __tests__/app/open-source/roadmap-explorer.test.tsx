/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { RoadmapExplorer } from "@/app/open-source/_components/RoadmapExplorer";

describe("RoadmapExplorer", () => {
  it("filters contribution ideas by category, difficulty, and search", () => {
    render(<RoadmapExplorer />);

    expect(screen.getByText("Showing 22 of 22 roadmap ideas.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by category"), {
      target: { value: "accessibility" },
    });
    fireEvent.change(screen.getByLabelText("Filter by difficulty"), {
      target: { value: "beginner" },
    });

    expect(screen.getByText("Keyboard Navigation Audit")).toBeInTheDocument();
    expect(screen.getByText("Color Contrast Check")).toBeInTheDocument();
    expect(screen.queryByText("Dark Mode Toggle")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 22 roadmap ideas.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search roadmap ideas"), {
      target: { value: "screen reader" },
    });

    expect(screen.getByText("No roadmap ideas match those filters.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByText("Dark Mode Toggle")).toBeInTheDocument();
    expect(screen.getByText("Showing 22 of 22 roadmap ideas.")).toBeInTheDocument();
  });
});
