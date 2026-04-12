import { render, screen } from "@testing-library/react";
import type { PublicMember } from "@/types/members";

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img data-fill={fill ? "true" : undefined} {...rest} />;
  },
}));

// Mock Firebase client
jest.mock("@/lib/firebase", () => ({ db: null }));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  getDocs: jest.fn(),
  onSnapshot: jest.fn(),
}));

// Mock badge subsystem — keep tests focused on MemberCard rendering
jest.mock("@/lib/badges/definitions", () => ({
  BADGE_DEFINITIONS: [
    { id: "first-steps", name: "First Steps", description: "d", category: "onboarding", howToEarn: "h", sortOrder: 1 },
    { id: "connected", name: "Connected", description: "d", category: "community", howToEarn: "h", sortOrder: 2 },
    { id: "contributor", name: "Contributor", description: "d", category: "contributions", howToEarn: "h", sortOrder: 3 },
  ],
}));

jest.mock("@/lib/badges/eligibility", () => ({
  evaluateBadgeEligibility: jest.fn(() => ({
    "first-steps": { badgeId: "first-steps", isEligible: true },
    connected: { badgeId: "connected", isEligible: false },
    contributor: { badgeId: "contributor", isEligible: false },
  })),
}));

jest.mock("@/lib/badges/utils", () => ({
  getEarnedBadgeIds: jest.fn(() => ["first-steps"]),
}));

jest.mock("@/components/badges/BadgeGrid", () => ({
  BadgeGrid: (props: Record<string, unknown>) => (
    <div data-testid="badge-grid" data-compact={props.compact ? "true" : undefined} />
  ),
}));

import { MemberCard } from "@/components/members/MemberCard";

function buildMember(overrides: Partial<PublicMember> = {}): PublicMember {
  return {
    uid: "user-1",
    displayName: "Jane Doe",
    photoURL: null,
    memberType: "human",
    bio: "Full-stack developer",
    location: "Boston, MA",
    company: "Acme Corp",
    jobTitle: "Senior Engineer",
    discord: { username: "jane#1234" },
    github: { login: "janedoe", html_url: "https://github.com/janedoe" },
    eventsAttended: 3,
    talksGiven: 1,
    pullRequestsCount: 5,
    socialLinks: {
      website: "https://jane.dev",
      linkedIn: "https://linkedin.com/in/janedoe",
      twitter: "https://x.com/janedoe",
      github: "https://github.com/janedoe",
      substack: "https://janedoe.substack.com",
    },
    visibility: {
      showEmail: false,
      showBio: true,
      showLocation: true,
      showCompany: true,
      showJobTitle: true,
      showDiscord: true,
      showGithubBadge: true,
      showEventsAttended: true,
      showTalksGiven: true,
      showWebsite: true,
      showLinkedIn: true,
      showTwitter: true,
      showGithub: true,
      showSubstack: true,
      showMemberSince: true,
    },
    createdAt: { toDate: () => new Date("2025-06-15") },
    ...overrides,
  };
}

describe("MemberCard", () => {
  it("renders the member display name", () => {
    render(<MemberCard member={buildMember()} />);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("shows 'Anonymous' when displayName is null", () => {
    render(<MemberCard member={buildMember({ displayName: null })} />);
    expect(screen.getByText("Anonymous")).toBeInTheDocument();
  });

  it("renders the member photo when photoURL is provided", () => {
    render(<MemberCard member={buildMember({ photoURL: "https://example.com/photo.jpg" })} />);
    const img = screen.getByAltText("Jane Doe");
    expect(img).toHaveAttribute("src", "https://example.com/photo.jpg");
  });

  it("renders initials when no photoURL is provided", () => {
    render(<MemberCard member={buildMember({ photoURL: null })} />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("displays the 'Human' type tag for human members", () => {
    render(<MemberCard member={buildMember()} />);
    expect(screen.getByText("Human")).toBeInTheDocument();
  });

  it("displays the 'Agent' type tag for agent members", () => {
    render(<MemberCard member={buildMember({ memberType: "agent" })} />);
    expect(screen.getByText("Agent")).toBeInTheDocument();
  });

  it("shows job title and company when visible", () => {
    render(<MemberCard member={buildMember()} />);
    expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("hides job title when visibility is off", () => {
    const member = buildMember({
      visibility: { ...buildMember().visibility!, showJobTitle: false },
    });
    render(<MemberCard member={member} />);
    expect(screen.queryByText("Senior Engineer")).not.toBeInTheDocument();
  });

  it("shows bio when visible", () => {
    render(<MemberCard member={buildMember()} />);
    expect(screen.getByText("Full-stack developer")).toBeInTheDocument();
  });

  it("hides bio when showBio is false", () => {
    const member = buildMember({
      visibility: { ...buildMember().visibility!, showBio: false },
    });
    render(<MemberCard member={member} />);
    expect(screen.queryByText("Full-stack developer")).not.toBeInTheDocument();
  });

  it("shows location when visible", () => {
    render(<MemberCard member={buildMember()} />);
    expect(screen.getByText("Boston, MA")).toBeInTheDocument();
  });

  it("hides location when showLocation is false", () => {
    const member = buildMember({
      visibility: { ...buildMember().visibility!, showLocation: false },
    });
    render(<MemberCard member={member} />);
    expect(screen.queryByText("Boston, MA")).not.toBeInTheDocument();
  });

  it("shows Discord badge when visible and connected", () => {
    render(<MemberCard member={buildMember()} />);
    expect(screen.getByText("Discord")).toBeInTheDocument();
  });

  it("shows GitHub badge when visible and connected", () => {
    render(<MemberCard member={buildMember()} />);
    expect(screen.getByText("GitHub")).toBeInTheDocument();
  });

  it("shows events attended count", () => {
    render(<MemberCard member={buildMember()} />);
    expect(screen.getByText("3 events attended")).toBeInTheDocument();
  });

  it("shows singular 'event' for count of 1", () => {
    render(<MemberCard member={buildMember({ eventsAttended: 1 })} />);
    expect(screen.getByText("1 event attended")).toBeInTheDocument();
  });

  it("shows talks given count", () => {
    render(<MemberCard member={buildMember()} />);
    expect(screen.getByText("1 talk given")).toBeInTheDocument();
  });

  it("shows pull requests count", () => {
    render(<MemberCard member={buildMember()} />);
    expect(screen.getByText("5 PRs")).toBeInTheDocument();
  });

  it("shows singular 'PR' for count of 1", () => {
    render(<MemberCard member={buildMember({ pullRequestsCount: 1 })} />);
    expect(screen.getByText("1 PR")).toBeInTheDocument();
  });

  it("shows Hack-a-Sprint badge when present", () => {
    render(<MemberCard member={buildMember({ hackASprint2026ShowcaseBadge: true })} />);
    expect(screen.getByText("Hack-a-Sprint '26")).toBeInTheDocument();
  });

  it("renders social links when visible", () => {
    render(<MemberCard member={buildMember()} />);
    expect(screen.getByLabelText("Website (opens in new tab)")).toHaveAttribute("href", "https://jane.dev");
    expect(screen.getByLabelText("LinkedIn (opens in new tab)")).toHaveAttribute("href", "https://linkedin.com/in/janedoe");
    expect(screen.getByLabelText("X/Twitter (opens in new tab)")).toHaveAttribute("href", "https://x.com/janedoe");
    expect(screen.getByLabelText("GitHub (opens in new tab)")).toHaveAttribute("href", "https://github.com/janedoe");
    expect(screen.getByLabelText("Substack (opens in new tab)")).toHaveAttribute("href", "https://janedoe.substack.com");
  });

  it("shows 'Member since' date when visible", () => {
    render(<MemberCard member={buildMember()} />);
    expect(screen.getByText(/Member since/)).toBeInTheDocument();
    expect(screen.getByText(/Jun 2025/)).toBeInTheDocument();
  });

  it("hides 'Member since' when showMemberSince is false", () => {
    const member = buildMember({
      visibility: { ...buildMember().visibility!, showMemberSince: false },
    });
    render(<MemberCard member={member} />);
    expect(screen.queryByText(/Member since/)).not.toBeInTheDocument();
  });

  it("renders the badge grid with compact mode", () => {
    render(<MemberCard member={buildMember()} />);
    const grid = screen.getByTestId("badge-grid");
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveAttribute("data-compact", "true");
  });

  describe("agent members", () => {
    it("does not show job title or company for agents", () => {
      render(
        <MemberCard
          member={buildMember({
            memberType: "agent",
            jobTitle: "Bot",
            company: "BotCo",
          })}
        />
      );
      expect(screen.queryByText("Bot")).not.toBeInTheDocument();
      expect(screen.queryByText("BotCo")).not.toBeInTheDocument();
    });

    it("shows owner name when visible", () => {
      render(
        <MemberCard
          member={buildMember({
            memberType: "agent",
            owner: { displayName: "Alice" },
            visibility: { ...buildMember().visibility!, showOwner: true },
          })}
        />
      );
      expect(screen.getByText("Owned by Alice")).toBeInTheDocument();
    });
  });
});
