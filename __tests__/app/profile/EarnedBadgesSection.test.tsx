 

import { render, screen } from "@testing-library/react";
import { EarnedBadgesSection } from "@/app/(auth)/profile/_components/EarnedBadgesSection";
import type { ProfileContextValue } from "@/app/(auth)/profile/_contexts/ProfileContext";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

jest.mock("firebase/auth", () => ({ getAuth: jest.fn() }));

jest.mock("@/components/badges/BadgeGrid", () => ({
  BadgeGrid: ({ definitions }: { definitions: unknown[] }) => (
    <div data-testid="badge-grid">
      {definitions.length} badge(s)
    </div>
  ),
}));

let mockContextValue: Partial<ProfileContextValue>;

jest.mock("@/app/(auth)/profile/_contexts/ProfileContext", () => ({
  useProfileContext: () => mockContextValue,
}));

const baseBadges = {
  eligibilityMap: {},
  userBadgeMap: {},
  earnedIds: [] as string[],
  earnedDefinitions: [] as unknown[],
  loading: false,
  dataStatus: { state: "complete" as const, isAuthoritative: true, failedSources: [], message: null },
  persistenceStatus: { state: "complete" as const, message: null },
  usingFallback: false,
};

describe("EarnedBadgesSection", () => {
  beforeEach(() => {
    mockContextValue = { badges: { ...baseBadges } as unknown as ProfileContextValue["badges"] };
  });

  it("renders section title and link", () => {
    render(<EarnedBadgesSection />);
    expect(screen.getByText("Earned Badges")).toBeInTheDocument();
    const link = screen.getByText("View all badges");
    expect(link.closest("a")).toHaveAttribute("href", "/badges");
  });

  it("shows empty state when no badges earned", () => {
    render(<EarnedBadgesSection />);
    expect(screen.getByText(/No badges earned yet/)).toBeInTheDocument();
  });

  it("shows loading indicator", () => {
    mockContextValue = {
      badges: { ...baseBadges, loading: true } as unknown as ProfileContextValue["badges"],
    };
    render(<EarnedBadgesSection />);
    expect(screen.getByText("Updating...")).toBeInTheDocument();
  });

  it("renders BadgeGrid when badges are earned", () => {
    mockContextValue = {
      badges: {
        ...baseBadges,
        earnedDefinitions: [{ id: "b1", name: "First Badge" }],
        earnedIds: ["b1"],
      } as unknown as ProfileContextValue["badges"],
    };
    render(<EarnedBadgesSection />);
    expect(screen.getByTestId("badge-grid")).toBeInTheDocument();
    expect(screen.getByText("1 badge(s)")).toBeInTheDocument();
  });

  it("shows warning when data status is not complete", () => {
    mockContextValue = {
      badges: {
        ...baseBadges,
        dataStatus: {
          state: "partial",
          isAuthoritative: false,
          failedSources: [],
          message: "Some data unavailable",
        },
      } as unknown as ProfileContextValue["badges"],
    };
    render(<EarnedBadgesSection />);
    expect(screen.getByText("Some data unavailable")).toBeInTheDocument();
  });

  it("shows error when persistence status failed", () => {
    mockContextValue = {
      badges: {
        ...baseBadges,
        persistenceStatus: {
          state: "failed",
          message: "Save failed",
        },
      } as unknown as ProfileContextValue["badges"],
    };
    render(<EarnedBadgesSection />);
    expect(screen.getByText("Save failed")).toBeInTheDocument();
  });

  it("shows fallback notice when using fallback data", () => {
    mockContextValue = {
      badges: {
        ...baseBadges,
        usingFallback: true,
      } as unknown as ProfileContextValue["badges"],
    };
    render(<EarnedBadgesSection />);
    expect(screen.getByText(/fallback data/)).toBeInTheDocument();
  });

  it("shows failed sources in dev mode", () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, "NODE_ENV", { value: "development", writable: true });
    mockContextValue = {
      badges: {
        ...baseBadges,
        dataStatus: {
          state: "partial",
          isAuthoritative: false,
          failedSources: ["github", "discord"],
          message: "Partial data",
        },
      } as unknown as ProfileContextValue["badges"],
    };
    render(<EarnedBadgesSection />);
    expect(screen.getByText(/github, discord/)).toBeInTheDocument();
    Object.defineProperty(process.env, "NODE_ENV", { value: originalEnv, writable: true });
  });
});
