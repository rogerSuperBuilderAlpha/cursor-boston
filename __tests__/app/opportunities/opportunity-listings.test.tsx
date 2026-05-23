/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { OpportunityListings } from "@/app/opportunities/_components/OpportunityListings";
import type { OpportunityListing } from "@/lib/opportunity-listings";

const opportunities: OpportunityListing[] = [
  {
    id: "cofounder",
    title: "CTO / Co-Founder",
    company: "BeatM",
    type: "cofounder",
    compensation: "Equity",
    location: "Boston, MA",
    remote: false,
    postedDate: "2026-02-06",
    description: "Build social fantasy sports with a founding team.",
    aboutCompany: "A sports community startup building in Boston.",
    team: [
      {
        name: "Harry",
        role: "COO",
        bio: "Runs growth and partnerships.",
      },
    ],
    tags: ["Sports Tech"],
    contactEmail: "hello@example.com",
    featured: true,
  },
  {
    id: "remote-contract",
    title: "AI Product Engineer",
    company: "Northstar",
    type: "contract",
    compensation: "$100/hr",
    location: "Remote",
    remote: true,
    postedDate: "2026-02-07",
    description: "Prototype AI workflows for customer support teams.",
    tags: ["AI"],
    applyUrl: "https://example.com/apply",
  },
];

describe("OpportunityListings", () => {
  it("filters listings and resets back to the full list", () => {
    render(<OpportunityListings opportunities={opportunities} />);

    const status = screen.getByRole("status");
    const searchInput = screen.getByLabelText("Search opportunities");

    expect(status).toHaveTextContent("Showing 2 of 2 listings.");
    expect(screen.getByText("CTO / Co-Founder")).toBeInTheDocument();
    expect(screen.getByText("AI Product Engineer")).toBeInTheDocument();
    expect(screen.getByText("A sports community startup building in Boston.")).toBeInTheDocument();
    expect(screen.getByText("Harry")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /contact/i })).toHaveAttribute(
      "href",
      "mailto:hello@example.com"
    );

    fireEvent.change(screen.getByLabelText("Filter by opportunity type"), {
      target: { value: "contract" },
    });

    expect(screen.queryByText("CTO / Co-Founder")).not.toBeInTheDocument();
    expect(screen.getByText("AI Product Engineer")).toBeInTheDocument();
    expect(status).toHaveTextContent("Showing 1 of 2 listings.");

    fireEvent.change(searchInput, {
      target: { value: "does-not-exist" },
    });

    expect(status).toHaveTextContent("No opportunities match those filters.");
    expect(screen.getByText("No opportunities match those filters.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByText("CTO / Co-Founder")).toBeInTheDocument();
    expect(status).toHaveTextContent("Showing 2 of 2 listings.");
    expect(searchInput).toHaveFocus();
  });

  it("filters listings by work mode", () => {
    render(<OpportunityListings opportunities={opportunities} />);

    fireEvent.change(screen.getByLabelText("Filter by work mode"), {
      target: { value: "remote" },
    });

    expect(screen.queryByText("CTO / Co-Founder")).not.toBeInTheDocument();
    expect(screen.getByText("AI Product Engineer")).toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 2 listings.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by work mode"), {
      target: { value: "in-person" },
    });

    expect(screen.getByText("CTO / Co-Founder")).toBeInTheDocument();
    expect(screen.queryByText("AI Product Engineer")).not.toBeInTheDocument();
  });

  it("renders a clear empty state when there are no listings", () => {
    render(<OpportunityListings opportunities={[]} />);

    expect(screen.getByText("Showing 0 of 0 listings.")).toBeInTheDocument();
    expect(
      screen.getByText("No opportunities posted yet. Check back soon!")
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Search opportunities")).not.toBeInTheDocument();
  });
});
