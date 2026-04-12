import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BadgePopover } from "@/components/badges/BadgePopover";
import type { BadgeDefinition, BadgeEligibilityResult } from "@/lib/badges/types";

const baseDef: BadgeDefinition = {
  id: "first-steps",
  name: "First Steps",
  description: "Complete your profile setup",
  category: "onboarding",
  howToEarn: "Fill out all profile fields",
  sortOrder: 1,
};

const onClose = jest.fn();

beforeEach(() => {
  onClose.mockClear();
});

describe("BadgePopover", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <BadgePopover definition={baseDef} isOpen={false} onClose={onClose} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog when isOpen is true", () => {
    render(<BadgePopover definition={baseDef} isOpen={true} onClose={onClose} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("displays the badge name as heading", () => {
    render(<BadgePopover definition={baseDef} isOpen={true} onClose={onClose} />);
    expect(screen.getByText("First Steps")).toBeInTheDocument();
  });

  it("displays description and howToEarn", () => {
    render(<BadgePopover definition={baseDef} isOpen={true} onClose={onClose} />);
    expect(screen.getByText("Complete your profile setup")).toBeInTheDocument();
    expect(screen.getByText("Fill out all profile fields")).toBeInTheDocument();
  });

  it("shows 'Locked' when not eligible", () => {
    render(<BadgePopover definition={baseDef} isOpen={true} onClose={onClose} />);
    expect(screen.getByText("Locked")).toBeInTheDocument();
  });

  it("shows 'Earned' when eligible", () => {
    const eligibility: BadgeEligibilityResult = {
      badgeId: "first-steps",
      isEligible: true,
    };
    render(
      <BadgePopover
        definition={baseDef}
        eligibility={eligibility}
        isOpen={true}
        onClose={onClose}
      />
    );
    expect(screen.getByText("Earned")).toBeInTheDocument();
  });

  it("displays progress bar when eligibility has progress", () => {
    const eligibility: BadgeEligibilityResult = {
      badgeId: "first-steps",
      isEligible: false,
      progress: { current: 2, target: 10, unit: "posts" },
    };
    render(
      <BadgePopover
        definition={baseDef}
        eligibility={eligibility}
        isOpen={true}
        onClose={onClose}
      />
    );
    expect(screen.getByText("2/10 posts")).toBeInTheDocument();
  });

  it("displays reason as 'Next step' when not earned", () => {
    const eligibility: BadgeEligibilityResult = {
      badgeId: "first-steps",
      isEligible: false,
      reason: "Add a bio to your profile",
    };
    render(
      <BadgePopover
        definition={baseDef}
        eligibility={eligibility}
        isOpen={true}
        onClose={onClose}
      />
    );
    expect(screen.getByText("Next step")).toBeInTheDocument();
    expect(screen.getByText("Add a bio to your profile")).toBeInTheDocument();
  });

  it("does not show reason when earned", () => {
    const eligibility: BadgeEligibilityResult = {
      badgeId: "first-steps",
      isEligible: true,
      reason: "Completed",
    };
    render(
      <BadgePopover
        definition={baseDef}
        eligibility={eligibility}
        isOpen={true}
        onClose={onClose}
      />
    );
    expect(screen.queryByText("Next step")).not.toBeInTheDocument();
  });

  it("displays showcaseApprovalNote when provided", () => {
    render(
      <BadgePopover
        definition={baseDef}
        isOpen={true}
        onClose={onClose}
        showcaseApprovalNote="Must have approved submission"
      />
    );
    expect(screen.getByText("Must have approved submission")).toBeInTheDocument();
    expect(screen.getByText("Verification")).toBeInTheDocument();
  });

  it("calls onClose when Close button is clicked", () => {
    render(<BadgePopover definition={baseDef} isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", () => {
    render(<BadgePopover definition={baseDef} isOpen={true} onClose={onClose} />);
    const backdrop = screen.getAllByRole("button", { name: "Close" })[0];
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("displays anchorLabel when provided", () => {
    render(
      <BadgePopover
        definition={baseDef}
        isOpen={true}
        onClose={onClose}
        anchorLabel="Custom label"
      />
    );
    expect(screen.getByText("Custom label")).toBeInTheDocument();
  });

  it("defaults to 'Achievement badge' when no anchorLabel", () => {
    render(<BadgePopover definition={baseDef} isOpen={true} onClose={onClose} />);
    expect(screen.getByText("Achievement badge")).toBeInTheDocument();
  });

  it("has correct aria attributes on dialog", () => {
    render(<BadgePopover definition={baseDef} isOpen={true} onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute(
      "aria-labelledby",
      `badge-popover-title-${baseDef.id}`
    );
  });
});
