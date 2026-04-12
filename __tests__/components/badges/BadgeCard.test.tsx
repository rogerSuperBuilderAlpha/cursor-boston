import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BadgeCard } from "@/components/badges/BadgeCard";
import type { BadgeDefinition, BadgeEligibilityResult } from "@/lib/badges/types";

const baseDef: BadgeDefinition = {
  id: "first-steps",
  name: "First Steps",
  description: "Complete your profile setup",
  category: "onboarding",
  howToEarn: "Fill out all profile fields",
  sortOrder: 1,
  iconKey: "sparkles",
};

describe("BadgeCard", () => {
  it("renders the badge name and description", () => {
    render(<BadgeCard definition={baseDef} />);
    expect(screen.getByText("First Steps")).toBeInTheDocument();
    expect(screen.getByText("Complete your profile setup")).toBeInTheDocument();
  });

  it("shows 'Locked' status when not earned", () => {
    render(<BadgeCard definition={baseDef} earned={false} />);
    expect(screen.getByText("Locked")).toBeInTheDocument();
  });

  it("shows 'Earned' status when earned is true", () => {
    render(<BadgeCard definition={baseDef} earned={true} />);
    expect(screen.getByText("Earned")).toBeInTheDocument();
  });

  it("derives earned state from eligibility when earned prop is undefined", () => {
    const eligibility: BadgeEligibilityResult = {
      badgeId: "first-steps",
      isEligible: true,
    };
    render(<BadgeCard definition={baseDef} eligibility={eligibility} />);
    expect(screen.getByText("Earned")).toBeInTheDocument();
  });

  it("displays the eligibility reason when not earned", () => {
    const eligibility: BadgeEligibilityResult = {
      badgeId: "first-steps",
      isEligible: false,
      reason: "Need to add a bio",
    };
    render(<BadgeCard definition={baseDef} eligibility={eligibility} earned={false} />);
    expect(screen.getByText("Need to add a bio")).toBeInTheDocument();
  });

  it("shows progress bar when eligibility has progress", () => {
    const eligibility: BadgeEligibilityResult = {
      badgeId: "first-steps",
      isEligible: false,
      progress: { current: 3, target: 5, unit: "events" },
    };
    render(<BadgeCard definition={baseDef} eligibility={eligibility} earned={false} />);
    expect(screen.getByText("Progress: 3/5 events")).toBeInTheDocument();
  });

  it("shows earned date when awardedAt is provided and earned", () => {
    render(
      <BadgeCard definition={baseDef} earned={true} awardedAt="2026-01-15T00:00:00Z" />
    );
    expect(screen.getByText("Earned Jan 2026")).toBeInTheDocument();
  });

  it("shows unverified data text when not authoritative and not earned", () => {
    render(<BadgeCard definition={baseDef} earned={false} isAuthoritative={false} />);
    expect(screen.getByText("Unverified data")).toBeInTheDocument();
  });

  it("opens popover on click", () => {
    render(<BadgeCard definition={baseDef} />);
    const article = screen.getByRole("button", { name: "First Steps" });
    fireEvent.click(article);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("has correct aria attributes", () => {
    render(<BadgeCard definition={baseDef} />);
    const article = screen.getByRole("button", { name: "First Steps" });
    expect(article).toHaveAttribute("aria-haspopup", "dialog");
    expect(article).toHaveAttribute("tabindex", "0");
  });

  it("applies custom className", () => {
    render(<BadgeCard definition={baseDef} className="custom-class" />);
    const article = screen.getByRole("button", { name: "First Steps" });
    expect(article.className).toContain("custom-class");
  });

  it("renders the fallback icon when iconKey is undefined", () => {
    const defNoIcon = { ...baseDef, iconKey: undefined };
    render(<BadgeCard definition={defNoIcon} />);
    // Renders without crashing - fallback icon used
    expect(screen.getByRole("button", { name: "First Steps" })).toBeInTheDocument();
  });
});
