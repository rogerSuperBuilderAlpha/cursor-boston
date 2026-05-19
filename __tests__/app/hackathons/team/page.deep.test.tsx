/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;
const mockUpdateDoc = updateDoc as jest.Mock;

const UID = "team-deep-uid";
const VIRTUAL_ID = "virtual-2026-05";

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
  };
}

function baseTeamDashboard(overrides: Record<string, unknown> = {}) {
  return {
    myTeam: {
      id: "team-deep",
      hackathonId: VIRTUAL_ID,
      memberIds: [UID, "member-2", "member-3"],
      name: "Deep Runners",
      wins: 0,
      createdBy: UID,
      createdAt: "2026-05-01T12:00:00.000Z",
    },
    memberProfiles: {
      [UID]: { uid: UID, displayName: "Deep User", photoURL: null },
      "member-2": { uid: "member-2", displayName: "Teammate Two", photoURL: null },
      "member-3": { uid: "member-3", displayName: "Teammate Three", photoURL: null },
    },
    submission: null,
    myInvites: [],
    requestsToMyTeam: [],
    ...overrides,
  };
}

function installTeamFetch(dashboard: Record<string, unknown>) {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method || "GET").toUpperCase();

    if (url.includes("/api/hackathons/team-dashboard")) {
      return jsonResponse(dashboard);
    }
    if (url.includes("/api/hackathons/invites/accept") && method === "POST") {
      return jsonResponse({ success: true });
    }
    if (url.includes("/api/hackathons/requests/accept") && method === "POST") {
      return jsonResponse({ success: true });
    }
    if (url.includes("/api/hackathons/team/leave") && method === "POST") {
      return jsonResponse({ success: true, lockoutUntilNextMonth: false });
    }
    if (url.includes("/api/hackathons/submissions/register") && method === "POST") {
      return jsonResponse({ success: true });
    }
    if (url.includes("/api/hackathons/submissions/submit") && method === "POST") {
      return jsonResponse({ success: true });
    }
    if (url.includes("/api/hackathons/team/profile") && method === "PATCH") {
      return jsonResponse({ success: true });
    }
    return jsonResponse({});
  }) as typeof fetch;
}

describe("hackathons team page deep", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
    window.alert = jest.fn();
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(UID),
      loading: false,
    });
    const mockDoc = doc as unknown as jest.Mock;
    if (typeof mockDoc.mockImplementation === "function") {
      mockDoc.mockImplementation((_db: unknown, ...segments: string[]) => ({
        path: segments.join("/"),
      }));
    }
  });

  it("prompts signed-out visitors to sign in", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    installTeamFetch(baseTeamDashboard({ myTeam: null }));

    const Page = (await import("@/app/hackathons/team/page")).default;
    render(<Page />);

    expect(await screen.findByText(/Sign in to view and manage your team/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sign in/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/login"),
    );
  });

  it("shows no-team state with link to pool", async () => {
    installTeamFetch(
      baseTeamDashboard({
        myTeam: null,
        myInvites: [
          {
            id: "invite-1",
            fromUserId: "captain",
            toUserId: UID,
            teamId: "team-other",
            status: "pending",
            createdAt: "2026-05-09T12:00:00.000Z",
          },
        ],
      }),
    );

    const Page = (await import("@/app/hackathons/team/page")).default;
    render(<Page />);

    expect(await screen.findByText(/You are not on a team/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Find a team/i })).toHaveAttribute(
      "href",
      "/hackathons/pool",
    );
    expect(screen.getByText(/Invites to you/i)).toBeInTheDocument();
  });

  it("renders team members including the current user marker", async () => {
    installTeamFetch(baseTeamDashboard());
    const Page = (await import("@/app/hackathons/team/page")).default;
    render(<Page />);

    expect(await screen.findByText(/Team members \(3\/3\)/i)).toBeInTheDocument();
    expect(screen.getByText("Deep User")).toBeInTheDocument();
    expect(screen.getByText("(you)")).toBeInTheDocument();
  });

  it("accepts a pending invite", async () => {
    installTeamFetch(
      baseTeamDashboard({
        myTeam: null,
        myInvites: [
          {
            id: "invite-accept",
            fromUserId: "captain",
            toUserId: UID,
            teamId: "team-other",
            status: "pending",
            createdAt: "2026-05-09T12:00:00.000Z",
          },
        ],
      }),
    );

    const Page = (await import("@/app/hackathons/team/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await screen.findByText(/Invites to you/i);
    await user.click(screen.getByRole("button", { name: /^Accept$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/hackathons/invites/accept",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("declines a pending invite via Firestore update", async () => {
    installTeamFetch(
      baseTeamDashboard({
        myTeam: null,
        myInvites: [
          {
            id: "invite-decline",
            fromUserId: "captain",
            toUserId: UID,
            teamId: "team-other",
            status: "pending",
            createdAt: "2026-05-09T12:00:00.000Z",
          },
        ],
      }),
    );

    const Page = (await import("@/app/hackathons/team/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await screen.findByText(/Invites to you/i);
    await user.click(screen.getByRole("button", { name: /^Decline$/i }));

    await waitFor(() => {
      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });

  it("accepts a join request to the user's team", async () => {
    installTeamFetch(
      baseTeamDashboard({
        requestsToMyTeam: [
          {
            id: "req-join",
            fromUserId: "applicant-1",
            teamId: "team-deep",
            status: "pending",
            createdAt: "2026-05-11T12:00:00.000Z",
          },
        ],
      }),
    );

    const Page = (await import("@/app/hackathons/team/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    expect(
      await screen.findByRole("heading", { name: /Requests to join your team/i }),
    ).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /^Accept$/i }).pop()!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/hackathons/requests/accept",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("leaves the team after confirmation", async () => {
    installTeamFetch(baseTeamDashboard());
    const Page = (await import("@/app/hackathons/team/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await screen.findByRole("button", { name: /Leave team/i });
    await user.click(screen.getByRole("button", { name: /Leave team/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/hackathons/team/leave",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("team-deep"),
        }),
      );
    });
  });

  it("registers a repo URL for a full virtual team", async () => {
    installTeamFetch(baseTeamDashboard());
    const Page = (await import("@/app/hackathons/team/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    const repoInput = await screen.findByPlaceholderText(
      "https://github.com/owner/repo",
    );
    await user.type(repoInput, "https://github.com/example/deep-repo");
    await user.click(screen.getByRole("button", { name: /Register repo/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/hackathons/submissions/register",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("deep-repo"),
        }),
      );
    });
  });

  it("submits and locks when repo is registered", async () => {
    installTeamFetch(
      baseTeamDashboard({
        submission: {
          id: "sub-1",
          hackathonId: VIRTUAL_ID,
          teamId: "team-deep",
          repoUrl: "https://github.com/example/ready-repo",
          registeredBy: UID,
          registeredAt: "2026-05-10T12:00:00.000Z",
          submittedAt: null,
        },
      }),
    );

    const Page = (await import("@/app/hackathons/team/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await screen.findByText(/Registered repo:/i);
    await user.click(screen.getByRole("button", { name: /Submit \/ lock/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/hackathons/submissions/submit",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows locked team profile copy when team has no wins", async () => {
    installTeamFetch(baseTeamDashboard());
    const Page = (await import("@/app/hackathons/team/page")).default;
    render(<Page />);

    expect(
      await screen.findByText(/Win a hackathon to unlock a team profile/i),
    ).toBeInTheDocument();
  });

  it("saves team profile when wins unlock branding", async () => {
    installTeamFetch(
      baseTeamDashboard({
        myTeam: {
          id: "team-deep",
          hackathonId: VIRTUAL_ID,
          memberIds: [UID, "member-2", "member-3"],
          name: "Deep Runners",
          wins: 2,
          createdBy: UID,
          createdAt: "2026-05-01T12:00:00.000Z",
        },
      }),
    );

    const Page = (await import("@/app/hackathons/team/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    const nameInput = await screen.findByLabelText(/Team name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Winning Crew");
    await user.click(screen.getByRole("button", { name: /Save profile/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/hackathons/team/profile",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining("Winning Crew"),
        }),
      );
    });
  });
});
