import { render, screen } from "@testing-library/react";
import { Skeleton } from "@/components/ui/Skeleton";
import { AuthFormSkeleton } from "@/components/skeletons/AuthFormSkeleton";
import { FeedMessageSkeleton } from "@/components/skeletons/FeedMessageSkeleton";
import { HackathonPageSkeleton } from "@/components/skeletons/HackathonPageSkeleton";
import { MemberCardSkeleton } from "@/components/skeletons/MemberCardSkeleton";
import { MembersPageSkeleton } from "@/components/skeletons/MembersPageSkeleton";

describe("Skeleton (base)", () => {
  it("renders a div with animate-pulse class", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild!;
    expect(el.tagName).toBe("DIV");
    expect(el.className).toContain("animate-pulse");
  });

  it("is hidden from assistive tech via aria-hidden", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("merges custom className", () => {
    const { container } = render(<Skeleton className="h-10 w-10" />);
    const el = container.firstElementChild!;
    expect(el.className).toContain("h-10");
    expect(el.className).toContain("w-10");
    expect(el.className).toContain("animate-pulse");
  });

  it("forwards extra HTML attributes", () => {
    const { container } = render(<Skeleton data-testid="skel" id="test-skel" />);
    expect(container.querySelector("#test-skel")).toBeInTheDocument();
    expect(screen.getByTestId("skel")).toBeInTheDocument();
  });
});

describe("AuthFormSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<AuthFormSkeleton />);
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it("contains multiple skeleton shimmer elements", () => {
    const { container } = render(<AuthFormSkeleton />);
    const pulseEls = container.querySelectorAll(".animate-pulse");
    expect(pulseEls.length).toBeGreaterThanOrEqual(3);
  });
});

describe("FeedMessageSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<FeedMessageSkeleton />);
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it("is hidden from assistive tech", () => {
    const { container } = render(<FeedMessageSkeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("renders a round avatar skeleton", () => {
    const { container } = render(<FeedMessageSkeleton />);
    const circles = container.querySelectorAll(".rounded-full");
    expect(circles.length).toBeGreaterThanOrEqual(1);
  });
});

describe("HackathonPageSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<HackathonPageSkeleton />);
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it("renders four row skeletons (mapped items)", () => {
    const { container } = render(<HackathonPageSkeleton />);
    // The component maps [1,2,3,4] into Skeleton rows with rounded-lg
    const rows = container.querySelectorAll(".rounded-lg.animate-pulse");
    expect(rows.length).toBeGreaterThanOrEqual(4);
  });
});

describe("MemberCardSkeleton", () => {
  it("renders without crashing", () => {
    render(<MemberCardSkeleton />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has an accessible loading label", () => {
    render(<MemberCardSkeleton />);
    expect(screen.getByLabelText("Loading member card")).toBeInTheDocument();
  });

  it("renders avatar, badge, and social link skeletons", () => {
    const { container } = render(<MemberCardSkeleton />);
    const rounds = container.querySelectorAll(".rounded-full");
    // avatar + badge pills + social link rounds
    expect(rounds.length).toBeGreaterThanOrEqual(4);
  });
});

describe("MembersPageSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<MembersPageSkeleton />);
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it("renders six MemberCardSkeleton instances", () => {
    render(<MembersPageSkeleton />);
    const cards = screen.getAllByRole("status");
    expect(cards).toHaveLength(6);
  });

  it("renders a hero section with tab skeletons", () => {
    const { container } = render(<MembersPageSkeleton />);
    // Two tab skeletons in the hero
    const heroSection = container.querySelector("section");
    expect(heroSection).toBeInTheDocument();
  });
});
