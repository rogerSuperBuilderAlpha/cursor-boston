/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;
const mockAddDoc = addDoc as jest.Mock;
const mockDeleteDoc = deleteDoc as jest.Mock;

const UID = "pool-uid";
const NOW_ISO = "2026-05-10T12:00:00.000Z";

interface PoolDashboardOverrides {
  poolEntries?: Array<{ userId: string; hackathonId: string; joinedAt: string | null }>;
  inPool?: boolean;
  poolUsers?: Record<string, unknown>;
  myTeam?: unknown;
  teamsWithSlots?: Array<unknown>;
  teamMemberProfiles?: Record<string, unknown>;
  successfulSubmissionsByTeam?: Record<string, number>;
  myInvites?: Array<unknown>;
  myInvitedUserIds?: string[];
  requestsToMyTeam?: Array<unknown>;
  myPendingRequestTeamIds?: string[];
}

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
  };
}

function baseDashboard(overrides: PoolDashboardOverrides = {}) {
  return {
    poolEntries: [],
    inPool: false,
    poolUsers: {},
    myTeam: null,
    teamsWithSlots: [],
    teamMemberProfiles: {},
    successfulSubmissionsByTeam: {},
    myInvites: [],
    myInvitedUserIds: [],
    requestsToMyTeam: [],
    myPendingRequestTeamIds: [],
    ...overrides,
  };
}

interface FetchOptions {
  dashboard?: PoolDashboardOverrides;
  dashboardOk?: boolean;
  eligible?: boolean;
  eligibleOk?: boolean;
  eligibilityReason?: string;
  joinOk?: boolean;
  joinError?: string;
}

function installFetch(opts: FetchOptions = {}) {
  const {
    dashboard,
    dashboardOk = true,
    eligible = true,
    eligibleOk = true,
    eligibilityReason = "",
    joinOk = true,
    joinError,
  } = opts;
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method || "GET").toUpperCase();
    if (url.includes("/api/hackathons/pool-dashboard")) {
      return jsonResponse(baseDashboard(dashboard), dashboardOk);
    }
    if (url.includes("/api/hackathons/eligibility")) {
      return jsonResponse({ eligible, reason: eligibilityReason }, eligibleOk);
    }
    if (url.includes("/api/hackathons/pool/join") && method === "POST") {
      return jsonResponse(
        joinOk ? { success: true } : { error: joinError || "nope" },
        joinOk,
      );
    }
    return jsonResponse({});
  }) as typeof fetch;
}

describe("hackathons pool page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.alert = jest.fn();
    mockAddDoc.mockResolvedValue({ id: "new-team" });
    mockDeleteDoc.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(UID),
      loading: false,
    });
  });

  it("shows the suspense spinner skeleton while auth is loading", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    installFetch();
    const Page = (await import("@/app/hackathons/pool/page")).default;
    const { container } = render(<Page />);
    // HackathonPageSkeleton renders some skeleton markup
    expect(container.firstChild).toBeTruthy();
  });

  it("renders sign-in CTA for anonymous visitors", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    installFetch();
    const Page = (await import("@/app/hackathons/pool/page")).default;
    render(<Page />);

    expect(await screen.findByRole("heading", { name: /Find a team/i })).toBeInTheDocument();
    expect(screen.getByText(/Sign in to join the pool/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Sign in/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("/login"));
    expect(link).toHaveAttribute("href", expect.stringContaining(encodeURIComponent("/hackathons/pool")));
  });

  it("renders empty pool state with eligibility info and ineligible join button", async () => {
    installFetch({
      eligible: false,
      eligibilityReason: "Complete your profile first.",
      dashboard: { inPool: false },
    });
    const Page = (await import("@/app/hackathons/pool/page")).default;
    render(<Page />);

    await screen.findByText(/Complete your profile first\./i);
    expect(screen.getByText(/No one in the pool yet/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Join the pool above to see and request teams with open slots\./i),
    ).toBeInTheDocument();

    const joinBtn = screen.getByRole("button", { name: /Join pool/i });
    expect(joinBtn).toBeDisabled();

    // The Profile link appears when eligible === false
    const profileLink = screen.getByRole("link", { name: /Profile/i });
    expect(profileLink).toHaveAttribute("href", "/profile");
  });

  it("renders pool with members and tells signed-in user to join to see teams", async () => {
    installFetch({
      dashboard: {
        poolEntries: [
          { userId: "u2", hackathonId: "virtual-x", joinedAt: NOW_ISO },
          { userId: "u3", hackathonId: "virtual-x", joinedAt: NOW_ISO },
          // poolEntry with no matching user - filtered out
          { userId: "ghost", hackathonId: "virtual-x", joinedAt: null },
        ],
        poolUsers: {
          u2: {
            uid: "u2",
            displayName: "Alice",
            photoURL: null,
            discord: { username: "alice#1234" },
            github: { login: "alice-gh" },
          },
          u3: {
            uid: "u3",
            displayName: null,
            photoURL: null,
          },
        },
        inPool: false,
      },
    });

    const Page = (await import("@/app/hackathons/pool/page")).default;
    render(<Page />);

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    // Anonymous fallback for null displayName
    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    expect(screen.getByText(/Discord: alice#1234/)).toBeInTheDocument();
    const githubLink = screen.getByRole("link", { name: /@alice-gh/ });
    expect(githubLink).toHaveAttribute("href", "https://github.com/alice-gh");
    // Not in pool yet, so we should see Join prompt for teams panel
    expect(
      screen.getByText(/Join the pool above to see and request teams with open slots/i),
    ).toBeInTheDocument();
  });

  it("shows 'in the pool' status and a working Leave pool button", async () => {
    installFetch({
      dashboard: {
        inPool: true,
        poolEntries: [
          { userId: UID, hackathonId: "virtual-x", joinedAt: NOW_ISO },
        ],
        poolUsers: {
          [UID]: { uid: UID, displayName: "Me", photoURL: null },
        },
      },
    });

    const Page = (await import("@/app/hackathons/pool/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    expect(await screen.findByText(/You are in the pool/i)).toBeInTheDocument();
    // (you) marker on yourself
    expect(screen.getByText(/\(you\)/i)).toBeInTheDocument();

    const leaveBtn = screen.getByRole("button", { name: /Leave pool/i });
    await user.click(leaveBtn);

    await waitFor(() => {
      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });

  it("alerts when leaving the pool fails", async () => {
    installFetch({
      dashboard: { inPool: true },
    });
    mockDeleteDoc.mockRejectedValueOnce(new Error("boom"));

    const Page = (await import("@/app/hackathons/pool/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await screen.findByRole("button", { name: /Leave pool/i });
    await user.click(screen.getByRole("button", { name: /Leave pool/i }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Failed to leave pool");
    });
  });

  it("joins the pool successfully", async () => {
    installFetch({
      dashboard: { inPool: false },
    });

    const Page = (await import("@/app/hackathons/pool/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await screen.findByRole("button", { name: /Join pool/i });
    await user.click(screen.getByRole("button", { name: /Join pool/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/hackathons/pool/join",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("alerts with server error message when join API returns !ok", async () => {
    installFetch({
      dashboard: { inPool: false },
      joinOk: false,
      joinError: "Server says no",
    });

    const Page = (await import("@/app/hackathons/pool/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await user.click(await screen.findByRole("button", { name: /Join pool/i }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Server says no");
    });
  });

  it("alerts with default copy when join throws non-Error", async () => {
    installFetch({
      dashboard: { inPool: false },
    });
    // Re-stub fetch to throw a non-Error on join
    const origFetch = global.fetch;
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();
      if (url.includes("/api/hackathons/pool/join") && method === "POST") {
        throw "boom"; // non-Error throw
      }
      return (origFetch as jest.Mock)(input, init);
    }) as typeof fetch;

    const Page = (await import("@/app/hackathons/pool/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await user.click(await screen.findByRole("button", { name: /Join pool/i }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Failed to join pool");
    });
  });

  it("handles dashboard fetch failure gracefully (no crash, no pool state)", async () => {
    installFetch({ dashboardOk: false });
    const consoleErr = jest.spyOn(console, "error").mockImplementation(() => {});

    const Page = (await import("@/app/hackathons/pool/page")).default;
    render(<Page />);

    await screen.findByRole("heading", { name: /Find a team/i });
    expect(consoleErr).toHaveBeenCalled();
    consoleErr.mockRestore();
  });

  it("shows fallback eligibility reason when eligibility API errors", async () => {
    installFetch({
      eligibleOk: false,
      dashboard: { inPool: false },
    });

    const Page = (await import("@/app/hackathons/pool/page")).default;
    render(<Page />);

    expect(
      await screen.findByText(/Could not check eligibility\./i),
    ).toBeInTheDocument();
  });

  it("displays invites and requests strips with proper pluralization", async () => {
    installFetch({
      dashboard: {
        inPool: true,
        myInvites: [
          {
            id: "inv-1",
            fromUserId: "u9",
            toUserId: UID,
            teamId: "team-a",
            status: "pending",
            createdAt: NOW_ISO,
          },
        ],
        requestsToMyTeam: [
          { id: "r-1", fromUserId: "u9", teamId: "team-mine", status: "pending", createdAt: NOW_ISO },
          { id: "r-2", fromUserId: "u8", teamId: "team-mine", status: "pending", createdAt: NOW_ISO },
        ],
      },
    });

    const Page = (await import("@/app/hackathons/pool/page")).default;
    render(<Page />);

    // Singular invite, plural requests
    expect(await screen.findByText(/1 team invited you/i)).toBeInTheDocument();
    expect(screen.getByText(/2 requests to your team/i)).toBeInTheDocument();
    // Two "Team page" links (one in each strip)
    expect(screen.getAllByRole("link", { name: /Team page/i }).length).toBeGreaterThanOrEqual(2);
  });

  it("displays plural invites and singular request copy", async () => {
    installFetch({
      dashboard: {
        inPool: true,
        myInvites: [
          { id: "i1", fromUserId: "u9", toUserId: UID, teamId: "t1", status: "pending", createdAt: NOW_ISO },
          { id: "i2", fromUserId: "u8", toUserId: UID, teamId: "t2", status: "pending", createdAt: NOW_ISO },
        ],
        requestsToMyTeam: [
          { id: "r-1", fromUserId: "u9", teamId: "mine", status: "pending", createdAt: NOW_ISO },
        ],
      },
    });

    const Page = (await import("@/app/hackathons/pool/page")).default;
    render(<Page />);

    expect(await screen.findByText(/2 teams invited you/i)).toBeInTheDocument();
    expect(screen.getByText(/1 request to your team/i)).toBeInTheDocument();
  });

  it("renders teams with open slots (members, placeholder, open slot, win badge) and lets user request to join", async () => {
    installFetch({
      dashboard: {
        inPool: true,
        teamsWithSlots: [
          {
            id: "open-team",
            hackathonId: "virtual-x",
            memberIds: ["u9", "mock-member-1"],
            name: "Hot Winners",
            logoUrl: "https://example.com/logo.png",
            wins: 2,
            createdBy: "u9",
            createdAt: new Date().toISOString(),
          },
          {
            id: "no-name-team",
            hackathonId: "virtual-x",
            memberIds: ["u10"],
            createdBy: "u10",
            createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
            wins: 0,
          },
          {
            id: "missing-profile-team",
            hackathonId: "virtual-x",
            memberIds: ["unknown-user"],
            createdBy: "unknown-user",
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "no-createdAt-team",
            hackathonId: "virtual-x",
            memberIds: ["u11"],
            createdBy: "u11",
            createdAt: null,
          },
        ],
        teamMemberProfiles: {
          u9: { uid: "u9", displayName: "Hot Captain", photoURL: null },
          u10: { uid: "u10", displayName: null, photoURL: null },
          u11: { uid: "u11", displayName: "Solo Builder", photoURL: null },
        },
        successfulSubmissionsByTeam: { "open-team": 3, "no-name-team": 1 },
        myPendingRequestTeamIds: ["no-name-team"],
      },
    });

    const Page = (await import("@/app/hackathons/pool/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    expect(await screen.findByText(/Hot Winners/)).toBeInTheDocument();
    // Default team name fallback
    expect(screen.getByText(/Team no-name-/i)).toBeInTheDocument();
    // Successful submissions text
    expect(screen.getByText(/3 successful submissions/)).toBeInTheDocument();
    expect(screen.getByText(/1 successful submission(?!s)/)).toBeInTheDocument();
    // Wins copy (2 wins)
    expect(screen.getByText(/2 wins/)).toBeInTheDocument();
    // Yesterday relative date for the day-old team
    expect(screen.getByText(/Yesterday/)).toBeInTheDocument();
    // Placeholder slot label appears (for mock-member-1 and missing profile)
    expect(screen.getAllByText(/^Member$/).length).toBeGreaterThan(0);
    // Open slot label appears (since the open-team only has 2 ids out of 3)
    expect(screen.getAllByText(/Open slot/).length).toBeGreaterThan(0);

    // Already-requested team shows "Requested" label
    expect(screen.getByText(/Requested/)).toBeInTheDocument();

    // Click Request on a team not yet requested
    const requestBtns = screen.getAllByRole("button", { name: /^Request$/ });
    await user.click(requestBtns[0]);

    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalled();
    });
  });

  it("reverts requestedTeam and alerts when addDoc fails for request-to-join", async () => {
    installFetch({
      dashboard: {
        inPool: true,
        teamsWithSlots: [
          {
            id: "fail-team",
            hackathonId: "virtual-x",
            memberIds: ["u9"],
            createdBy: "u9",
            createdAt: new Date().toISOString(),
          },
        ],
        teamMemberProfiles: {
          u9: { uid: "u9", displayName: "Captain", photoURL: null },
        },
      },
    });
    mockAddDoc.mockRejectedValueOnce(new Error("nope"));

    const Page = (await import("@/app/hackathons/pool/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await screen.findByText(/Team fail-tea/i);
    await user.click(screen.getByRole("button", { name: /^Request$/ }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Failed to send request");
    });
  });

  it("invites a pool user when canInvite is true (no existing team -> creates a team first)", async () => {
    installFetch({
      dashboard: {
        inPool: true,
        poolEntries: [
          { userId: UID, hackathonId: "virtual-x", joinedAt: NOW_ISO },
          { userId: "u4", hackathonId: "virtual-x", joinedAt: NOW_ISO },
        ],
        poolUsers: {
          [UID]: { uid: UID, displayName: "Me", photoURL: null },
          u4: { uid: "u4", displayName: "Invite Me", photoURL: null },
        },
      },
    });

    const Page = (await import("@/app/hackathons/pool/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    const inviteBtn = await screen.findByRole("button", { name: /^Invite$/ });
    await user.click(inviteBtn);

    // Two addDoc calls: one for hackathonTeams, one for hackathonInvites
    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalledTimes(2);
    });
    // After clicking, the button label should switch to "Invited"
    await waitFor(() => {
      expect(screen.getByText(/^Invited$/)).toBeInTheDocument();
    });
  });

  it("invites a pool user when user already has a team (does not create team)", async () => {
    installFetch({
      dashboard: {
        inPool: true,
        myTeam: {
          id: "my-team",
          hackathonId: "virtual-x",
          memberIds: [UID],
          createdBy: UID,
          createdAt: NOW_ISO,
          wins: 0,
        },
        poolEntries: [
          { userId: "u4", hackathonId: "virtual-x", joinedAt: NOW_ISO },
        ],
        poolUsers: {
          u4: { uid: "u4", displayName: "Pool Person", photoURL: null },
        },
      },
    });

    const Page = (await import("@/app/hackathons/pool/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    const inviteBtn = await screen.findByRole("button", { name: /^Invite$/ });
    await user.click(inviteBtn);

    // Only one addDoc call (for hackathonInvites), no team-creation addDoc.
    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
    });
  });

  it("rolls back invited state and alerts when invite addDoc fails", async () => {
    installFetch({
      dashboard: {
        inPool: true,
        myTeam: {
          id: "my-team",
          hackathonId: "virtual-x",
          memberIds: [UID],
          createdBy: UID,
          createdAt: NOW_ISO,
          wins: 0,
        },
        poolEntries: [{ userId: "u4", hackathonId: "virtual-x", joinedAt: NOW_ISO }],
        poolUsers: { u4: { uid: "u4", displayName: "Pool Person", photoURL: null } },
      },
    });
    mockAddDoc.mockRejectedValueOnce(new Error("invite failed"));

    const Page = (await import("@/app/hackathons/pool/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    const inviteBtn = await screen.findByRole("button", { name: /^Invite$/ });
    await user.click(inviteBtn);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Failed to send invite");
    });
    // The Invite button should be back (invitedUserIds rolled back)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Invite$/ })).toBeInTheDocument();
    });
  });

  it("renders 'Invited' for users already invited and no invite button when team is full", async () => {
    installFetch({
      dashboard: {
        inPool: true,
        myTeam: {
          id: "full-team",
          hackathonId: "virtual-x",
          memberIds: [UID, "uA", "uB"],
          createdBy: UID,
          createdAt: NOW_ISO,
        },
        poolEntries: [
          { userId: "u5", hackathonId: "virtual-x", joinedAt: NOW_ISO },
          { userId: "u6", hackathonId: "virtual-x", joinedAt: NOW_ISO },
        ],
        poolUsers: {
          u5: { uid: "u5", displayName: "Already Invited", photoURL: null },
          u6: { uid: "u6", displayName: "Not Invited", photoURL: null },
        },
        myInvitedUserIds: ["u5"],
      },
    });

    const Page = (await import("@/app/hackathons/pool/page")).default;
    render(<Page />);

    await screen.findByText("Already Invited");
    // Already-invited label
    expect(screen.getByText("Invited")).toBeInTheDocument();
    // No invite buttons should be visible (canInvite=false because team is full)
    expect(screen.queryByRole("button", { name: /^Invite$/ })).not.toBeInTheDocument();
  });

  it("filters out the user's own team and teams the user is already a member of from the open slots list", async () => {
    installFetch({
      dashboard: {
        inPool: true,
        myTeam: {
          id: "my-team",
          hackathonId: "virtual-x",
          memberIds: [UID],
          createdBy: UID,
          createdAt: NOW_ISO,
        },
        teamsWithSlots: [
          {
            id: "my-team",
            hackathonId: "virtual-x",
            memberIds: [UID],
            createdBy: UID,
            createdAt: NOW_ISO,
          },
          {
            id: "already-member-team",
            hackathonId: "virtual-x",
            memberIds: [UID, "uX"],
            createdBy: "uX",
            createdAt: NOW_ISO,
          },
          {
            id: "good-team",
            hackathonId: "virtual-x",
            memberIds: ["uY"],
            createdBy: "uY",
            createdAt: NOW_ISO,
          },
        ],
        teamMemberProfiles: {
          uY: { uid: "uY", displayName: "Good Captain", photoURL: null },
        },
      },
    });

    const Page = (await import("@/app/hackathons/pool/page")).default;
    render(<Page />);

    expect(await screen.findByText(/Team good-tea/i)).toBeInTheDocument();
    // The user's own team and the team they're a member of should be filtered out.
    expect(screen.queryByText(/Team my-team/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Team already-/i)).not.toBeInTheDocument();
  });

  it("shows 'No teams with open slots right now.' when in pool but no qualifying teams", async () => {
    installFetch({
      dashboard: {
        inPool: true,
        teamsWithSlots: [],
      },
    });

    const Page = (await import("@/app/hackathons/pool/page")).default;
    render(<Page />);

    expect(
      await screen.findByText(/No teams with open slots right now\./i),
    ).toBeInTheDocument();
  });

  it("formats createdAt as 'Today' for same-day team", async () => {
    installFetch({
      dashboard: {
        inPool: true,
        teamsWithSlots: [
          {
            id: "freshteam",
            hackathonId: "virtual-x",
            memberIds: ["uZ"],
            createdBy: "uZ",
            createdAt: new Date().toISOString(),
          },
        ],
        teamMemberProfiles: {
          uZ: { uid: "uZ", displayName: "Same Day", photoURL: null },
        },
      },
    });

    const Page = (await import("@/app/hackathons/pool/page")).default;
    render(<Page />);

    // findByText splits across text nodes; assert via a function matcher restricted to <p>
    expect(
      await screen.findByText((_, node) => {
        if (!node || node.tagName !== "P") return false;
        return /Created\s+Today/.test(node.textContent || "");
      }),
    ).toBeInTheDocument();
  });

  it("formats createdAt as a localized date for older teams", async () => {
    installFetch({
      dashboard: {
        inPool: true,
        teamsWithSlots: [
          {
            id: "old-team",
            hackathonId: "virtual-x",
            memberIds: ["uOld"],
            createdBy: "uOld",
            createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        teamMemberProfiles: {
          uOld: { uid: "uOld", displayName: "Old Cap", photoURL: null },
        },
      },
    });

    const Page = (await import("@/app/hackathons/pool/page")).default;
    render(<Page />);

    // The relative-date branch returns toLocaleDateString output (e.g. "4/10/2026")
    expect(await screen.findByText(/Created /)).toBeInTheDocument();
  });

  it("renders teams with createdAt as a {toDate} object (via tsFromIso null fallback path)", async () => {
    installFetch({
      dashboard: {
        inPool: true,
        teamsWithSlots: [
          {
            id: "null-date-team",
            hackathonId: "virtual-x",
            memberIds: ["uNd"],
            createdBy: "uNd",
            createdAt: null,
          },
        ],
        teamMemberProfiles: {
          uNd: { uid: "uNd", displayName: "Null Date Cap", photoURL: null },
        },
      },
    });

    const Page = (await import("@/app/hackathons/pool/page")).default;
    render(<Page />);

    // slice(0,8) of "null-date-team" is "null-dat"
    expect(await screen.findByText(/Team null-dat/i)).toBeInTheDocument();
  });

  it("does not allow inviting when team has 3 members (handleInvite early-return)", async () => {
    installFetch({
      dashboard: {
        inPool: true,
        myTeam: {
          id: "team-full",
          hackathonId: "virtual-x",
          memberIds: [UID, "x", "y"],
          createdBy: UID,
          createdAt: NOW_ISO,
        },
        poolEntries: [{ userId: "z", hackathonId: "virtual-x", joinedAt: NOW_ISO }],
        poolUsers: { z: { uid: "z", displayName: "Z User", photoURL: null } },
      },
    });

    const Page = (await import("@/app/hackathons/pool/page")).default;
    render(<Page />);

    await screen.findByText("Z User");
    // No Invite button rendered since canInvite is false (team is full)
    expect(screen.queryByRole("button", { name: /^Invite$/ })).not.toBeInTheDocument();
  });
});
