import React from "react";
import { render, screen } from "@testing-library/react";
import { BadgeGrid } from "@/components/badges/BadgeGrid";
import type { BadgeDefinition, BadgeEligibilityMap } from "@/lib/badges/types";

const definitions: BadgeDefinition[] = [
  {
    id: "first-steps",
    name: "First Steps",
    description: "Complete your profile",
    category: "onboarding",
    howToEarn: "Fill out profile",
    sortOrder: 1,
    iconKey: "sparkles",
  },
  {
    id: "connected",
    name: "Connected",
    description: "Link your accounts",
    category: "onboarding",
    howToEarn: "Connect Discord and GitHub",
    sortOrder: 2,
    iconKey: "link",
  },
];

describe("BadgeGrid", () => {
  it("renders all badge definitions", () => {
    render(<BadgeGrid definitions={definitions} />);
    expect(screen.getByText("First Steps")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("renders a section element", () => {
    const { container } = render(<BadgeGrid definitions={definitions} />);
    expect(container.querySelector("section")).toBeInTheDocument();
  });

  it("applies custom className to section", () => {
    const { container } = render(
      <BadgeGrid definitions={definitions} className="my-grid" />
    );
    expect(container.querySelector("section")?.className).toContain("my-grid");
  });

  it("renders grid layout by default", () => {
    const { container } = render(<BadgeGrid definitions={definitions} />);
    const grid = container.querySelector("section > div");
    expect(grid?.className).toContain("grid");
  });

  it("renders horizontal layout when specified", () => {
    const { container } = render(
      <BadgeGrid definitions={definitions} layout="horizontal" />
    );
    const flex = container.querySelector("section > div");
    expect(flex?.className).toContain("flex");
  });

  it("wraps cards in a min-width container for horizontal layout", () => {
    const { container } = render(
      <BadgeGrid definitions={definitions} layout="horizontal" />
    );
    const wrappers = container.querySelectorAll(".min-w-\\[260px\\]");
    expect(wrappers.length).toBe(2);
  });

  it("passes earned state from earnedBadgeIds", () => {
    render(
      <BadgeGrid definitions={definitions} earnedBadgeIds={["first-steps"]} />
    );
    const earnedLabels = screen.getAllByText("Earned");
    expect(earnedLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("passes eligibility from eligibilityMap", () => {
    const eligibilityMap = {
      "first-steps": {
        badgeId: "first-steps" as const,
        isEligible: false,
        reason: "Need bio",
        progress: { current: 2, target: 5 },
      },
    } as BadgeEligibilityMap;

    render(
      <BadgeGrid definitions={definitions} eligibilityMap={eligibilityMap} />
    );
    expect(screen.getByText("Progress: 2/5")).toBeInTheDocument();
  });

  it("renders empty grid when definitions is empty", () => {
    const { container } = render(<BadgeGrid definitions={[]} />);
    const grid = container.querySelector("section > div");
    expect(grid?.children.length).toBe(0);
  });
});
