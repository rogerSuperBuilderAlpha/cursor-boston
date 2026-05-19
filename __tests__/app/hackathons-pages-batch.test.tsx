/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: makeAuthUser(),
    userProfile: { displayName: "Dev", github: { login: "dev" } },
    loading: false,
  });
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("pool-dashboard")) {
      return {
        ok: true,
        json: async () => ({
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
        }),
      };
    }
    if (url.includes("team-dashboard")) {
      return {
        ok: true,
        json: async () => ({
          myTeam: null,
          memberProfiles: {},
          submission: null,
          myInvites: [],
          requestsToMyTeam: [],
        }),
      };
    }
    if (url.includes("/api/hackathons/eligibility")) {
      return {
        ok: true,
        json: async () => ({ eligible: true, reasons: [] }),
      };
    }
    if (url.includes("/api/hackathons/teams")) {
      return { ok: true, json: async () => ({ teams: [] }) };
    }
    if (url.includes("/api/hackathons/events") && url.includes("/signup")) {
      return {
        ok: true,
        json: async () => ({
          eventId: "sports-hack-2026",
          totalCount: 0,
          entries: [],
          creditTopN: 10,
          me: null,
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  }) as typeof fetch;
});

const PAGES = [
  () => import("@/app/hackathons/pool/page"),
  () => import("@/app/hackathons/team/page"),
  () => import("@/app/hackathons/teams/page"),
  () => import("@/app/hackathons/sports-hack-2026/signup/page"),
];

describe("hackathon pages (authed)", () => {
  it.each(PAGES)("renders page module", async (load) => {
    const { default: Page } = await load();
    const { container } = render(<Page />);
    await waitFor(
      () => {
        expect(container.innerHTML.length).toBeGreaterThan(20);
      },
      { timeout: 4000 },
    );
  });
});
