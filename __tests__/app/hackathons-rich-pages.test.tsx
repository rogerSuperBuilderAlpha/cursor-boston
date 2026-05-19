/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;

const nowIso = new Date().toISOString();

const team = {
  id: "team-rich-1",
  hackathonId: "virtual-2026-05",
  memberIds: ["u1", "u2", "u3"],
  name: "Coverage Crew",
  logoUrl: "https://example.com/logo.png",
  wins: 1,
  createdBy: "u1",
  createdAt: nowIso,
};

const memberProfiles = {
  u1: { uid: "u1", displayName: "Me", photoURL: null, github: { login: "me" } },
  u2: { uid: "u2", displayName: "Teammate", photoURL: null, github: { login: "mate" } },
  u3: { uid: "u3", displayName: "Builder", photoURL: null, github: { login: "builder" } },
  u4: { uid: "u4", displayName: "Pool Person", photoURL: null, github: { login: "pool" } },
};

describe("rich hackathon pages", () => {
  beforeEach(() => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      userProfile: { displayName: "Me", github: { login: "me" } },
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("team-dashboard")) {
        return {
          ok: true,
          json: async () => ({
            myTeam: team,
            memberProfiles,
            submission: {
              id: "sub-1",
              hackathonId: team.hackathonId,
              teamId: team.id,
              repoUrl: "https://github.com/me/project",
              registeredBy: "u1",
              registeredAt: nowIso,
              submittedAt: null,
              cutoffAt: nowIso,
            },
            myInvites: [
              {
                id: "invite-1",
                fromUserId: "u4",
                toUserId: "u1",
                teamId: "other-team",
                status: "pending",
                createdAt: nowIso,
              },
            ],
            requestsToMyTeam: [
              {
                id: "request-1",
                fromUserId: "u4",
                teamId: team.id,
                status: "pending",
                createdAt: nowIso,
              },
            ],
          }),
        };
      }
      if (url.includes("pool-dashboard")) {
        return {
          ok: true,
          json: async () => ({
            poolEntries: [
              { userId: "u1", hackathonId: team.hackathonId, joinedAt: nowIso },
              { userId: "u4", hackathonId: team.hackathonId, joinedAt: nowIso },
            ],
            inPool: true,
            poolUsers: { u1: memberProfiles.u1, u4: memberProfiles.u4 },
            myTeam: { ...team, memberIds: ["u1"] },
            teamsWithSlots: [
              { ...team, id: "open-team", memberIds: ["u2", "u3"] },
            ],
            teamMemberProfiles: memberProfiles,
            successfulSubmissionsByTeam: { "open-team": 2 },
            myInvites: [],
            myInvitedUserIds: [],
            requestsToMyTeam: [
              { id: "request-1", fromUserId: "u4", teamId: team.id, status: "pending", createdAt: nowIso },
            ],
            myPendingRequestTeamIds: [],
          }),
        };
      }
      if (url.includes("teams-board")) {
        return {
          ok: true,
          json: async () => ({
            teams: [
              { ...team, id: "open-team", memberIds: ["u2", "u3"] },
              { ...team, id: "full-team", memberIds: ["u1", "u2", "u3"] },
            ],
            memberProfiles,
            successfulSubmissionsByTeam: { "open-team": 2, "full-team": 1 },
            myTeamId: "full-team",
            inPool: true,
            myPendingRequestTeamIds: [],
          }),
        };
      }
      if (url.includes("/api/hackathons/eligibility")) {
        return { ok: true, json: async () => ({ eligible: true, reason: "" }) };
      }
      if (init?.method === "POST") {
        return { ok: true, json: async () => ({ success: true }) };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders rich team dashboard and posts team actions", async () => {
    const Page = (await import("@/app/hackathons/team/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByDisplayValue(/Coverage Crew/i)).toBeInTheDocument();
      expect(screen.getByText(/Requests to join your team/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /^Accept$/i })[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/hackathons/invites/accept",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("renders pool dashboard with people and open teams", async () => {
    const Page = (await import("@/app/hackathons/pool/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText(/Pool Person/i)).toBeInTheDocument();
      expect(screen.getByText(/Teams with open slots/i)).toBeInTheDocument();
    });
  });

  it("renders teams board with open and full teams", async () => {
    const Page = (await import("@/app/hackathons/teams/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText(/Teams with open slots/i)).toBeInTheDocument();
      expect(screen.getByText(/Full teams/i)).toBeInTheDocument();
    });
  });
});
