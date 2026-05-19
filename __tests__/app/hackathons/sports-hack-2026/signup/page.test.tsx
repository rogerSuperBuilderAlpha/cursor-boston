/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";
import { SPORTS_HACK_2026_EVENT_ID } from "@/lib/sports-hack-2026";

const mockUseAuth = useAuth as jest.Mock;
const signupUrl = `/api/hackathons/events/${SPORTS_HACK_2026_EVENT_ID}/signup`;

const leaderboardPayload = {
  eventId: SPORTS_HACK_2026_EVENT_ID,
  totalCount: 1,
  websiteSignupCount: 1,
  entries: [
    {
      rank: 1,
      userId: "u1",
      displayName: "Builder",
      githubLogin: "builder",
      mergedPrCount: 3,
      signedUpAt: "2026-05-20T12:00:00.000Z",
      creditEligible: true,
      status: "confirmed" as const,
      lumaRegistered: true,
    },
  ],
  creditTopN: 80,
  me: {
    signedUp: true,
    rank: 1,
    mergedPrCount: 3,
    signedUpAt: "2026-05-20T12:00:00.000Z",
    creditEligible: true,
    willBeLate: false,
    queuingForSpot: false,
    lumaRegistered: true,
  },
};

const notSignedUpPayload = {
  eventId: SPORTS_HACK_2026_EVENT_ID,
  totalCount: 0,
  websiteSignupCount: 0,
  entries: [],
  creditTopN: 80,
  me: {
    signedUp: false,
    rank: null,
    mergedPrCount: null,
    signedUpAt: null,
    creditEligible: false,
    willBeLate: false,
    queuingForSpot: false,
    lumaRegistered: false,
  },
};

const postFreezePayload = {
  eventId: SPORTS_HACK_2026_EVENT_ID,
  totalCount: 2,
  websiteSignupCount: 2,
  entries: [
    {
      rank: 1,
      userId: "u1",
      displayName: "Builder",
      githubLogin: "builder",
      mergedPrCount: 3,
      signedUpAt: "2026-05-20T12:00:00.000Z",
      creditEligible: true,
      status: "confirmed" as const,
      lumaRegistered: true,
    },
    {
      rank: 2,
      userId: "u2",
      displayName: "Waiter",
      githubLogin: "waiter",
      mergedPrCount: 0,
      signedUpAt: "2026-05-21T12:00:00.000Z",
      creditEligible: false,
      status: "waitlisted" as const,
      lumaRegistered: false,
    },
  ],
  creditTopN: 80,
  me: {
    signedUp: true,
    rank: 1,
    mergedPrCount: 3,
    signedUpAt: "2026-05-20T12:00:00.000Z",
    creditEligible: true,
    willBeLate: false,
    queuingForSpot: false,
    lumaRegistered: true,
  },
};

function mockSignupFetch(
  signupBody: typeof leaderboardPayload | typeof notSignedUpPayload | typeof postFreezePayload = leaderboardPayload,
) {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === signupUrl && method === "GET") {
      return { ok: true, json: async () => signupBody };
    }
    if (url === signupUrl && method === "POST") {
      return { ok: true, json: async () => leaderboardPayload };
    }
    if (url === signupUrl && method === "PATCH") {
      return { ok: true, json: async () => ({ ...signupBody, me: { ...signupBody.me, willBeLate: true } }) };
    }
    if (url === signupUrl && method === "DELETE") {
      return { ok: true, json: async () => ({}) };
    }
    if (url === "/api/profile/visibility") {
      if (method === "PATCH") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            visibility: { isPublic: true, showDiscord: true },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          profile: {
            hasGithub: true,
            githubUsername: "builder",
            hasDiscord: true,
            discordUsername: "builder#0001",
            visibility: { isPublic: true, showDiscord: true },
          },
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  }) as typeof fetch;
}

describe("Sports Hack 2026 signup page", () => {
  beforeEach(() => {
    mockSignupFetch();
  });

  it("renders signup CTA when signed out", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
    });
    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);
    await waitFor(() => {
      expect(
        screen.getByText(/Sign in or create an account to claim your spot/i),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Sign in/i })).toHaveAttribute(
        "href",
        expect.stringContaining("/login"),
      );
    });
    expect(global.fetch).toHaveBeenCalledWith(
      signupUrl,
      expect.objectContaining({ headers: {} }),
    );
  });

  it("shows signed-up state for authenticated users", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      userProfile: {
        displayName: "Builder",
        github: { login: "builder" },
        discord: { username: "builder#0001" },
      },
      loading: false,
    });
    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText(/You are signed up/i)).toBeInTheDocument();
      expect(screen.getByText("Builder")).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith(
      signupUrl,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer /),
        }),
      }),
    );
  });

  it("shows profile requirements and claims spot when ready", async () => {
    mockSignupFetch(notSignedUpPayload);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u-new"),
      userProfile: {
        displayName: "New Builder",
        github: { login: "newbuilder" },
        discord: { username: "new#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });
    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    expect(
      await screen.findByText(/Complete your profile to sign up/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/4\/4 requirements met/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Claim my spot/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        signupUrl,
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows missing GitHub connect link when profile incomplete", async () => {
    mockSignupFetch(notSignedUpPayload);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u-partial"),
      userProfile: {
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });
    (global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === signupUrl) {
        return { ok: true, json: async () => notSignedUpPayload };
      }
      if (url === "/api/profile/visibility") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            profile: {
              hasGithub: false,
              githubUsername: null,
              hasDiscord: false,
              discordUsername: null,
              visibility: { isPublic: true, showDiscord: false },
            },
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    expect(await screen.findByRole("link", { name: /Connect GitHub/i })).toHaveAttribute(
      "href",
      "/api/github/authorize",
    );
    expect(screen.getByRole("button", { name: /Complete requirements/i })).toBeDisabled();
  });

  it("renders post-freeze day-of RSVP controls for confirmed users", async () => {
    mockSignupFetch(postFreezePayload);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      userProfile: {
        displayName: "Builder",
        github: { login: "builder" },
        discord: { username: "builder#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });
    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    expect(await screen.findByText(/Day-of RSVP/i)).toBeInTheDocument();
    expect(screen.getByText(/Waitlist starts here/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /I'll be late but I'm coming/i }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        signupUrl,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ willBeLate: true }),
        }),
      );
    });
  });

  it("surfaces load errors from the leaderboard API", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === signupUrl) {
        return {
          ok: false,
          json: async () => ({ error: "Leaderboard unavailable" }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;

    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      userProfile: null,
      loading: false,
    });
    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    expect(await screen.findByText(/Leaderboard unavailable/i)).toBeInTheDocument();
  });
});
