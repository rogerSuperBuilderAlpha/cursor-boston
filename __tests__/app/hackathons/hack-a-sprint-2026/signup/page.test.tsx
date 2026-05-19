/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";
import { HACK_A_SPRINT_2026_EVENT_ID } from "@/lib/hackathon-showcase";

const mockUseAuth = useAuth as jest.Mock;
const signupUrl = `/api/hackathons/events/${HACK_A_SPRINT_2026_EVENT_ID}/signup`;

const readyProfile = {
  hasGithub: true,
  githubUsername: "signup-user",
  hasDiscord: true,
  discordUsername: "signup#0001",
  visibility: { isPublic: true, showDiscord: true },
};

const incompleteProfile = {
  hasGithub: false,
  githubUsername: null,
  hasDiscord: false,
  discordUsername: null,
  visibility: { isPublic: false, showDiscord: false },
};

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
  };
}

function baseLeaderboard(
  me: Record<string, unknown> | null = null,
  entries: unknown[] = [],
) {
  return {
    eventId: HACK_A_SPRINT_2026_EVENT_ID,
    totalCount: entries.length,
    websiteSignupCount: entries.length,
    entries,
    creditTopN: 80,
    me,
  };
}

function installSignupFetch(options: {
  me?: Record<string, unknown> | null;
  profile?: typeof readyProfile;
  entries?: unknown[];
} = {}) {
  const { me = null, profile = readyProfile, entries = [] } = options;

  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method || "GET").toUpperCase();

    if (url.includes(signupUrl) && method === "GET") {
      return jsonResponse(baseLeaderboard(me, entries));
    }
    if (url.includes(signupUrl) && method === "POST") {
      return jsonResponse(baseLeaderboard({ signedUp: true, rank: 1, mergedPrCount: 2, creditEligible: true, willBeLate: false, queuingForSpot: false }));
    }
    if (url.includes(signupUrl) && method === "PATCH") {
      return jsonResponse(baseLeaderboard({ ...me, ...(JSON.parse(String(init?.body)) as object) }));
    }
    if (url.includes(signupUrl) && method === "DELETE") {
      return jsonResponse({ ok: true });
    }
    if (url.includes("/api/profile/visibility") && method === "GET") {
      return jsonResponse({ success: true, profile });
    }
    if (url.includes("/api/profile/visibility") && method === "PATCH") {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return jsonResponse({
        success: true,
        visibility: { ...profile.visibility, ...body },
      });
    }
    return jsonResponse({});
  }) as typeof fetch;
}

describe("Hack-a-Sprint 2026 signup page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
    });
  });

  it("renders signed-out signup prompt with auth links", async () => {
    installSignupFetch();
    const Page = (await import("@/app/hackathons/hack-a-sprint-2026/signup/page")).default;
    render(<Page />);

    expect(
      await screen.findByText(/Sign in or create an account to claim your spot/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sign in/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/login"),
    );
  });

  it("shows profile requirements gate for signed-in users", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: null,
      loading: false,
    });
    installSignupFetch({ profile: incompleteProfile });

    const Page = (await import("@/app/hackathons/hack-a-sprint-2026/signup/page")).default;
    render(<Page />);

    expect(
      await screen.findByText(/Complete your profile to sign up/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/0\/4 requirements met/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Complete requirements to sign up/i }),
    ).toBeDisabled();
  });

  it("claims a spot when profile requirements are met", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: {
        github: { login: "signup-user" },
        discord: { username: "signup#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });
    installSignupFetch({ profile: readyProfile });

    const Page = (await import("@/app/hackathons/hack-a-sprint-2026/signup/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await user.click(
      await screen.findByRole("button", { name: /Claim my spot/i }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        signupUrl,
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows signed-up rank summary for enrolled users", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: {
        github: { login: "signup-user" },
        discord: { username: "signup#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });
    installSignupFetch({
      me: {
        signedUp: true,
        rank: 3,
        mergedPrCount: 4,
        creditEligible: true,
        willBeLate: false,
        queuingForSpot: false,
      },
      entries: [
        {
          rank: 1,
          userId: "u2",
          displayName: "Leader",
          githubLogin: "leader",
          mergedPrCount: 10,
          signedUpAt: "2026-04-01T12:00:00.000Z",
          creditEligible: true,
        },
      ],
    });

    const Page = (await import("@/app/hackathons/hack-a-sprint-2026/signup/page")).default;
    render(<Page />);

    expect(await screen.findByText(/You are signed up/i)).toBeInTheDocument();
    const summary = screen.getByText(/You are signed up/i).closest("div");
    expect(summary?.textContent).toMatch(/Rank/);
    expect(summary?.textContent).toMatch(/#3/);
    expect(summary?.textContent).toMatch(/credit band/i);
  });

  it("marks credit-eligible attendee as running late via PATCH", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: {
        github: { login: "signup-user" },
        discord: { username: "signup#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });
    installSignupFetch({
      me: {
        signedUp: true,
        rank: 2,
        mergedPrCount: 5,
        creditEligible: true,
        willBeLate: false,
        queuingForSpot: false,
      },
    });

    const Page = (await import("@/app/hackathons/hack-a-sprint-2026/signup/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await user.click(
      await screen.findByRole("button", { name: /I'll be late but I'm coming/i }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        signupUrl,
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"willBeLate":true'),
        }),
      );
    });
  });

  it("queues for a waitlist spot when not credit-eligible", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: {
        github: { login: "signup-user" },
        discord: { username: "signup#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });
    installSignupFetch({
      me: {
        signedUp: true,
        rank: 120,
        mergedPrCount: 0,
        creditEligible: false,
        willBeLate: false,
        queuingForSpot: false,
      },
    });

    const Page = (await import("@/app/hackathons/hack-a-sprint-2026/signup/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await user.click(
      await screen.findByRole("button", { name: /I'll be there to queue for a spot/i }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        signupUrl,
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"queuingForSpot":true'),
        }),
      );
    });
  });

  it("toggles public profile visibility from requirements panel", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: null,
      loading: false,
    });
    installSignupFetch({ profile: incompleteProfile });

    const Page = (await import("@/app/hackathons/hack-a-sprint-2026/signup/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    const toggles = await screen.findAllByRole("button");
    const publicToggle = toggles.find((btn) =>
      btn.className.includes("rounded-full"),
    );
    expect(publicToggle).toBeTruthy();
    await user.click(publicToggle!);

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

  it("leaves the signup list after confirmation", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: {
        github: { login: "signup-user" },
        discord: { username: "signup#0001" },
        visibility: { isPublic: true, showDiscord: true },
      },
      loading: false,
    });
    installSignupFetch({
      me: {
        signedUp: true,
        rank: 8,
        mergedPrCount: 1,
        creditEligible: false,
        willBeLate: false,
        queuingForSpot: false,
      },
    });

    const Page = (await import("@/app/hackathons/hack-a-sprint-2026/signup/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await user.click(await screen.findByRole("button", { name: /Leave list/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        signupUrl,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});
