/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { ensureUserBadgesForEligibleWithStatus } from "@/lib/badges/data";
import { BADGE_DEFINITIONS } from "@/lib/badges/definitions";

jest.mock("@/lib/badges/data", () => ({
  ...jest.requireActual("@/lib/badges/data"),
  ensureUserBadgesForEligibleWithStatus: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockEnsureBadges =
  ensureUserBadgesForEligibleWithStatus as jest.MockedFunction<
    typeof ensureUserBadgesForEligibleWithStatus
  >;

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  };
}

function signedInAuth() {
  return {
    user: {
      email: "builder@example.com",
      getIdToken: jest.fn().mockResolvedValue("test-token"),
      uid: "user-1",
    },
    userProfile: {
      displayName: "Builder One",
    },
    loading: false,
  };
}

describe("SkillsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue(signedInAuth());
    mockEnsureBadges.mockResolvedValue({
      status: { state: "complete" },
      userBadgeMap: {},
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/badges/definitions")) {
        return jsonResponse({
          definitions: BADGE_DEFINITIONS,
          source: "firestore",
        });
      }

      if (url.includes("/api/profile/data")) {
        return jsonResponse({
          badgeEligibility: {
            input: {
              communityMessagesCount: 4,
              hasAvatar: true,
              hasBio: true,
              hasDiscordConnected: true,
              hasGithubConnected: true,
              pullRequestsCount: 1,
            },
            status: {
              failedSources: [],
              isAuthoritative: true,
              state: "complete",
            },
          },
          stats: { pullRequestsCount: 1 },
          userBadgeMap: {},
        });
      }

      return jsonResponse({});
    }) as typeof fetch;
  });

  it("renders badge-backed skill tracks for signed-in users", async () => {
    const Page = (await import("@/app/skills/page")).default;
    render(<Page />);

    expect(
      await screen.findByRole("heading", { name: "Skills Passport" })
    ).toBeInTheDocument();
    expect(screen.getByText("Build and Ship")).toBeInTheDocument();
    expect(screen.getByText("Community Practice")).toBeInTheDocument();
    expect(await screen.findByText("3/9")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
    expect(screen.getAllByText("Conversation Starter").length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(mockEnsureBadges).toHaveBeenCalled();
    });
  });

  it("shows a passport data notice when profile data cannot load", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/badges/definitions")) {
        return jsonResponse({
          definitions: BADGE_DEFINITIONS,
          source: "firestore",
        });
      }

      return jsonResponse({ error: "profile unavailable" }, false);
    }) as typeof fetch;

    const Page = (await import("@/app/skills/page")).default;
    render(<Page />);

    expect(
      await screen.findByText("Skills passport data could not be loaded right now.")
    ).toBeInTheDocument();
  });
});
