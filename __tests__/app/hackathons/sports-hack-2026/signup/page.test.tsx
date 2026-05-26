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
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
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

  it("shows checking-account loading state while auth is loading", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: true,
    });
    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);
    expect(
      await screen.findByText(/Checking account/i),
    ).toBeInTheDocument();
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

  it("surfaces signup POST error from the API", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u-new"),
      userProfile: {
        github: { login: "newbuilder" },
        discord: { username: "new#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === signupUrl && method === "GET") {
        return { ok: true, json: async () => notSignedUpPayload };
      }
      if (url === signupUrl && method === "POST") {
        return { ok: false, json: async () => ({ error: "Already at capacity" }) };
      }
      if (url === "/api/profile/visibility") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            profile: {
              hasGithub: true,
              githubUsername: "newbuilder",
              hasDiscord: true,
              discordUsername: "new#0001",
              visibility: { isPublic: true, showDiscord: true },
            },
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;

    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    fireEvent.click(await screen.findByRole("button", { name: /Claim my spot/i }));
    expect(await screen.findByText(/Already at capacity/i)).toBeInTheDocument();
  });

  it("falls back to default signup error message when API returns invalid JSON", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u-new"),
      userProfile: {
        github: { login: "newbuilder" },
        discord: { username: "new#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === signupUrl && method === "GET") {
        return { ok: true, json: async () => notSignedUpPayload };
      }
      if (url === signupUrl && method === "POST") {
        return {
          ok: false,
          json: async () => {
            throw new Error("boom");
          },
        };
      }
      if (url === "/api/profile/visibility") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            profile: {
              hasGithub: true,
              githubUsername: "newbuilder",
              hasDiscord: true,
              discordUsername: "new#0001",
              visibility: { isPublic: true, showDiscord: true },
            },
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;

    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    fireEvent.click(await screen.findByRole("button", { name: /Claim my spot/i }));
    expect(await screen.findByText(/Sign up failed/i)).toBeInTheDocument();
  });

  it("shows missing GitHub connect link when profile incomplete", async () => {
    mockSignupFetch(notSignedUpPayload);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u-partial"),
      userProfile: null,
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

    // Connect GitHub is now a button that delegates to useGithubConnection.connect()
    // (sets window.location.href with the right returnTo). The Discord button
    // is still a plain link until it gets the same treatment.
    expect(
      await screen.findByRole("button", { name: /Connect GitHub/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Connect Discord/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/api/discord/authorize?returnTo="),
    );
    expect(screen.getByRole("link", { name: /Join Discord first/i })).toHaveAttribute(
      "href",
      "https://discord.gg/Wsncg8YYqc",
    );
    expect(screen.getByRole("button", { name: /Complete requirements/i })).toBeDisabled();
    // 1/4 requirements met (isPublic only)
    expect(screen.getByText(/1\/4 requirements met/i)).toBeInTheDocument();
  });

  it("toggles public profile visibility and refreshes the page state", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u-toggle"),
      userProfile: null,
      loading: false,
    });
    (global.fetch as jest.Mock).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url === signupUrl) {
          return { ok: true, json: async () => notSignedUpPayload };
        }
        if (url === "/api/profile/visibility" && method === "GET") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              profile: {
                hasGithub: true,
                githubUsername: "tg",
                hasDiscord: true,
                discordUsername: "tg#1",
                visibility: { isPublic: false, showDiscord: false },
              },
            }),
          };
        }
        if (url === "/api/profile/visibility" && method === "PATCH") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              visibility: { isPublic: true, showDiscord: false },
            }),
          };
        }
        return { ok: true, json: async () => ({}) };
      },
    );

    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    // Find the visibility toggle (round button under Public profile row)
    await screen.findByText(/Public profile/i);
    const allButtons = screen.getAllByRole("button");
    const publicToggle = allButtons.find((b) => b.className.includes("w-11"));
    expect(publicToggle).toBeTruthy();
    fireEvent.click(publicToggle!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/profile/visibility",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"isPublic":true'),
        }),
      );
    });
  });

  it("toggles showDiscord visibility from the row toggle", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u-toggle-d"),
      userProfile: null,
      loading: false,
    });
    (global.fetch as jest.Mock).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url === signupUrl) {
          return { ok: true, json: async () => notSignedUpPayload };
        }
        if (url === "/api/profile/visibility" && method === "GET") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              profile: {
                hasGithub: true,
                githubUsername: "tg",
                hasDiscord: true,
                discordUsername: "tg#1",
                visibility: { isPublic: true, showDiscord: false },
              },
            }),
          };
        }
        if (url === "/api/profile/visibility" && method === "PATCH") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              visibility: { isPublic: true, showDiscord: true },
            }),
          };
        }
        return { ok: true, json: async () => ({}) };
      },
    );

    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    await screen.findByText(/Show Discord on profile/i);
    const allButtons = screen.getAllByRole("button");
    // There are two w-11 toggles (Public + ShowDiscord); pick the second.
    const toggles = allButtons.filter((b) => b.className.includes("w-11"));
    expect(toggles.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(toggles[1]!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/profile/visibility",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"showDiscord":true'),
        }),
      );
    });
  });

  it("disables Show-Discord toggle when Discord is not connected", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u-nd"),
      userProfile: null,
      loading: false,
    });
    (global.fetch as jest.Mock).mockImplementation(
      async (input: RequestInfo | URL) => {
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
                hasGithub: true,
                githubUsername: "tg",
                hasDiscord: false,
                discordUsername: null,
                visibility: { isPublic: true, showDiscord: false },
              },
            }),
          };
        }
        return { ok: true, json: async () => ({}) };
      },
    );

    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    expect(await screen.findByText(/Connect Discord first/i)).toBeInTheDocument();
    const allButtons = screen.getAllByRole("button");
    const toggles = allButtons.filter((b) => b.className.includes("w-11"));
    // ShowDiscord toggle should be disabled (Discord not connected)
    expect(toggles[1]).toBeDisabled();
  });

  it("renders profile loading skeleton when profile is null and loading", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u-loading"),
      userProfile: null,
      loading: false,
    });
    type Resolver = (value: {
      ok: boolean;
      json: () => Promise<unknown>;
    }) => void;
    let resolveProfile: Resolver | null = null;
    (global.fetch as jest.Mock).mockImplementation(
      async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === signupUrl) {
          return { ok: true, json: async () => notSignedUpPayload };
        }
        if (url === "/api/profile/visibility") {
          return new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
            resolveProfile = resolve;
          });
        }
        return { ok: true, json: async () => ({}) };
      },
    );

    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    const { container } = render(<Page />);

    await screen.findByText(/Complete your profile to sign up/i);
    await waitFor(() => {
      const skeletons = container.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBe(4);
    });

    // Resolve and let the component finish its state update inside act()
    await waitFor(() => expect(resolveProfile).not.toBeNull());
    resolveProfile!({
      ok: true,
      json: async () => ({
        success: true,
        profile: {
          hasGithub: true,
          githubUsername: "x",
          hasDiscord: true,
          discordUsername: "x#1",
          visibility: { isPublic: true, showDiscord: true },
        },
      }),
    });
    await waitFor(() => {
      expect(screen.getByText(/4\/4 requirements met/i)).toBeInTheDocument();
    });
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
    // PR 3 renamed the post-freeze waitlist-start divider to a credit-cutoff
    // banner with the explicit "Top N credit cutoff" wording. Mock has
    // creditTopN: 80 so the divider reads "Top 80 credit cutoff".
    expect(screen.getByText(/Top 80 credit cutoff/i)).toBeInTheDocument();

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

  it("clears the will-be-late flag from the post-freeze confirmed RSVP card", async () => {
    const willBeLatePayload = {
      ...postFreezePayload,
      me: { ...postFreezePayload.me, willBeLate: true },
    };
    mockSignupFetch(willBeLatePayload);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      userProfile: {
        github: { login: "builder" },
        discord: { username: "builder#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });

    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    expect(
      await screen.findByText(/We've noted you'll be late but you're still coming/i),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Clear — I'll arrive on time/i }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        signupUrl,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ willBeLate: false }),
        }),
      );
    });
  });

  it("shows waitlisted post-freeze view and queues for spot", async () => {
    const waitlistedMe = {
      ...postFreezePayload,
      me: {
        ...postFreezePayload.me,
        creditEligible: false,
        queuingForSpot: false,
      },
    };
    mockSignupFetch(waitlistedMe);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      userProfile: {
        github: { login: "builder" },
        discord: { username: "builder#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });

    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    expect(
      await screen.findByText(/You are on the/i),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /I'll be there to queue for a spot/i }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        signupUrl,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ queuingForSpot: true }),
        }),
      );
    });
  });

  it("clears the queue intent for waitlisted users", async () => {
    const waitlistedQueueing = {
      ...postFreezePayload,
      me: {
        ...postFreezePayload.me,
        creditEligible: false,
        queuingForSpot: true,
      },
    };
    mockSignupFetch(waitlistedQueueing);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      userProfile: {
        github: { login: "builder" },
        discord: { username: "builder#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });

    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    expect(
      await screen.findByText(/You're on the list to queue for an open spot/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Clear queue intent/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        signupUrl,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ queuingForSpot: false }),
        }),
      );
    });
  });

  it("gives up confirmed spot when user confirms the prompt", async () => {
    mockSignupFetch(postFreezePayload);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      userProfile: {
        github: { login: "builder" },
        discord: { username: "builder#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });

    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Give up my confirmed spot/i }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        signupUrl,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ giveUpSpot: true }),
        }),
      );
    });
  });

  it("cancels give-up-spot when user declines the confirm prompt", async () => {
    window.confirm = jest.fn(() => false);
    mockSignupFetch(postFreezePayload);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      userProfile: {
        github: { login: "builder" },
        discord: { username: "builder#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });

    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Give up my confirmed spot/i }),
    );

    // Confirm was called but PATCH with giveUpSpot should not have been issued
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
    });
    const calls = (global.fetch as jest.Mock).mock.calls;
    const patchGiveUp = calls.find(
      ([url, init]) =>
        url === signupUrl &&
        init?.method === "PATCH" &&
        typeof init?.body === "string" &&
        init.body.includes("giveUpSpot"),
    );
    expect(patchGiveUp).toBeUndefined();
  });

  it("surfaces give-up-spot error from the API", async () => {
    window.confirm = jest.fn(() => true);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      userProfile: {
        github: { login: "builder" },
        discord: { username: "builder#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === signupUrl && method === "GET") {
        return { ok: true, json: async () => postFreezePayload };
      }
      if (url === signupUrl && method === "PATCH" && typeof init?.body === "string" && init.body.includes("giveUpSpot")) {
        return { ok: false, json: async () => ({ error: "Cannot give up spot" }) };
      }
      if (url === "/api/profile/visibility") {
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

    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Give up my confirmed spot/i }),
    );

    expect(await screen.findByText(/Cannot give up spot/i)).toBeInTheDocument();
  });

  it("surfaces patchRsvp error from the API", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      userProfile: {
        github: { login: "builder" },
        discord: { username: "builder#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === signupUrl && method === "GET") {
        return { ok: true, json: async () => postFreezePayload };
      }
      if (url === signupUrl && method === "PATCH") {
        return { ok: false, json: async () => ({ error: "RSVP failed" }) };
      }
      if (url === "/api/profile/visibility") {
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

    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    fireEvent.click(
      await screen.findByRole("button", { name: /I'll be late but I'm coming/i }),
    );

    expect(await screen.findByText(/RSVP failed/i)).toBeInTheDocument();
  });

  it("leaves the signup list after confirmation", async () => {
    window.confirm = jest.fn(() => true);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      userProfile: {
        github: { login: "builder" },
        discord: { username: "builder#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });

    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    fireEvent.click(await screen.findByRole("button", { name: /Leave list/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        signupUrl,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  it("does not leave the list when confirmation is declined", async () => {
    window.confirm = jest.fn(() => false);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      userProfile: {
        github: { login: "builder" },
        discord: { username: "builder#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });

    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    fireEvent.click(await screen.findByRole("button", { name: /Leave list/i }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
    });
    const calls = (global.fetch as jest.Mock).mock.calls;
    const deleteCall = calls.find(([url, init]) => url === signupUrl && init?.method === "DELETE");
    expect(deleteCall).toBeUndefined();
  });

  it("surfaces leave-list error from the API", async () => {
    window.confirm = jest.fn(() => true);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      userProfile: {
        github: { login: "builder" },
        discord: { username: "builder#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === signupUrl && method === "GET") {
        return { ok: true, json: async () => leaderboardPayload };
      }
      if (url === signupUrl && method === "DELETE") {
        return { ok: false, json: async () => ({ error: "Could not leave" }) };
      }
      if (url === "/api/profile/visibility") {
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

    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    fireEvent.click(await screen.findByRole("button", { name: /Leave list/i }));
    expect(await screen.findByText(/Could not leave/i)).toBeInTheDocument();
  });

  it("clicks the Refresh button on the signed-up banner", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      userProfile: {
        github: { login: "builder" },
        discord: { username: "builder#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });
    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    await screen.findByText(/You are signed up/i);
    const refreshBtns = screen.getAllByRole("button", { name: /Refresh/i });
    fireEvent.click(refreshBtns[0]!);

    // Two GET calls should have happened total now (initial mount + refresh)
    await waitFor(() => {
      const getCalls = (global.fetch as jest.Mock).mock.calls.filter(
        ([url, init]) => url === signupUrl && (!init || init?.method !== "POST"),
      );
      expect(getCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("clicks the Refresh button on the profile-requirements card", async () => {
    mockSignupFetch(notSignedUpPayload);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u-refresh"),
      userProfile: {
        github: { login: "builder" },
        discord: { username: "builder#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });
    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    // The "Refresh" button only renders on the profile-requirements card.
    await screen.findByText(/Complete your profile to sign up/i);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^Refresh$/i }),
      ).toBeInTheDocument();
    });
    (global.fetch as jest.Mock).mockClear();
    fireEvent.click(screen.getByRole("button", { name: /^Refresh$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it("does NOT show a Luma warning when the user is signed up but not on Luma (website-first as of 2026-05-24)", async () => {
    const noLumaPayload = {
      ...leaderboardPayload,
      me: { ...leaderboardPayload.me, lumaRegistered: false },
    };
    mockSignupFetch(noLumaPayload);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      userProfile: {
        github: { login: "builder" },
        discord: { username: "builder#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });
    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    // Wait for the signup card to render so the assertion runs after the page settled.
    await screen.findByText(/You are signed up/i);
    // The previous rose "You're not on the Luma list yet / RSVP on Luma now"
    // warning was removed when the website became the source of truth.
    // Luma/Partiful presence is now informational only.
    expect(screen.queryByText(/You're not on the Luma list yet/i)).toBeNull();
    expect(
      screen.queryByRole("link", { name: /RSVP on Luma now/i }),
    ).toBeNull();
  });

  it("renders the rank tier label for a top-10 user (pre-freeze)", async () => {
    const preFreezePayload = {
      ...leaderboardPayload,
      entries: [
        {
          rank: 1,
          userId: "u1",
          displayName: "Builder",
          githubLogin: "builder",
          mergedPrCount: 3,
          signedUpAt: "2026-05-20T12:00:00.000Z",
          creditEligible: true,
          // no status → preFreeze branch
          lumaRegistered: true,
        },
      ],
    };
    mockSignupFetch(preFreezePayload);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      userProfile: null,
      loading: false,
    });
    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    // pre-freeze rank 1 → "On fire" tier label (renders in banner + table)
    const matches = await screen.findAllByText(/On fire/i);
    expect(matches.length).toBeGreaterThan(0);
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

  it("falls back to default leaderboard error when API has no error field", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === signupUrl) {
        return { ok: false, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;

    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
    });
    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    expect(await screen.findByText(/Could not load leaderboard/i)).toBeInTheDocument();
  });

  it("renders the no-registrants empty row", async () => {
    mockSignupFetch(notSignedUpPayload);
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
    });
    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    expect(await screen.findByText(/No registrants yet/i)).toBeInTheDocument();
  });

  it("renders a luma-only entry (userId null) in the participants table", async () => {
    const lumaOnly = {
      ...leaderboardPayload,
      entries: [
        {
          rank: 1,
          userId: null,
          displayName: null,
          githubLogin: null,
          mergedPrCount: 0,
          signedUpAt: "2026-05-20T12:00:00.000Z",
          creditEligible: true,
          lumaRegistered: true,
          isCohort1: true,
        },
      ],
      me: { ...leaderboardPayload.me, signedUp: false, rank: null },
    };
    mockSignupFetch(lumaOnly);
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
    });
    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    expect(await screen.findByText(/Cohort 1/i)).toBeInTheDocument();
    // displayName null renders as em-dash
    const dashCells = await screen.findAllByText("—");
    expect(dashCells.length).toBeGreaterThan(0);
  });

  it("toggleVisibility swallows API errors silently", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u-err"),
      userProfile: null,
      loading: false,
    });
    (global.fetch as jest.Mock).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url === signupUrl) {
          return { ok: true, json: async () => notSignedUpPayload };
        }
        if (url === "/api/profile/visibility" && method === "GET") {
          return {
            ok: true,
            json: async () => ({
              success: true,
              profile: {
                hasGithub: true,
                githubUsername: "x",
                hasDiscord: true,
                discordUsername: "x#1",
                visibility: { isPublic: false, showDiscord: false },
              },
            }),
          };
        }
        if (url === "/api/profile/visibility" && method === "PATCH") {
          throw new Error("network down");
        }
        return { ok: true, json: async () => ({}) };
      },
    );

    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    await screen.findByText(/Public profile/i);
    const allButtons = screen.getAllByRole("button");
    const publicToggle = allButtons.find((b) => b.className.includes("w-11"));
    fireEvent.click(publicToggle!);

    // No error displayed; component stays mounted
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/profile/visibility",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("loadProfile swallows fetch errors silently (context profile remains)", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u-ctx"),
      userProfile: {
        github: { login: "ctxuser" },
        discord: { username: "ctx#1" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });

    (global.fetch as jest.Mock).mockImplementation(
      async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === signupUrl) {
          return { ok: true, json: async () => notSignedUpPayload };
        }
        if (url === "/api/profile/visibility") {
          throw new Error("profile down");
        }
        return { ok: true, json: async () => ({}) };
      },
    );

    const Page = (await import("@/app/hackathons/sports-hack-2026/signup/page"))
      .default;
    render(<Page />);

    // Context-derived profile is still rendered (4/4 because context fills it)
    expect(
      await screen.findByText(/4\/4 requirements met/i),
    ).toBeInTheDocument();
  });
});
