/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import type { ProfileDataApiResponse } from "@/lib/profile-data-types";
import { useProfileData } from "@/app/(auth)/profile/_hooks/useProfileData";

const mockUser = {
  getIdToken: jest.fn().mockResolvedValue("profile-token"),
} as unknown as User;

const profilePayload: ProfileDataApiResponse = {
  stats: {
    eventsRegistered: 2,
    eventsAttended: 1,
    talksSubmitted: 1,
    talksGiven: 0,
    pullRequestsCount: 0,
  },
  registrations: [
    {
      id: "reg-1",
      eventId: "evt-1",
      eventTitle: "Cursor Boston Meetup",
      userId: "u1",
      userEmail: "u1@test.com",
      registeredAt: "2026-04-01T12:00:00.000Z",
      source: "luma",
      status: "registered",
    },
  ],
  talks: [
    {
      id: "talk-1",
      title: "Testing hooks",
      status: "pending",
      submittedAt: "2026-04-02T08:00:00.000Z",
    },
  ],
  badgeEligibility: { eligibleBadgeIds: [] },
  userBadgeMap: {},
};

describe("useProfileData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("clears state when user is null", async () => {
    const { result } = renderHook(() => useProfileData(null));

    await waitFor(() => {
      expect(result.current.loadingData).toBe(false);
    });

    expect(result.current.stats).toBeNull();
    expect(result.current.registrations).toEqual([]);
    expect(result.current.talkSubmissions).toEqual([]);
    expect(result.current.profileBundle).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("loads profile data and connected agents", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/profile/data")) {
        return {
          ok: true,
          json: async () => profilePayload,
        };
      }
      if (url === "/api/agents/user") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            agents: [{ id: "agent-1", name: "Helper" }],
          }),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as typeof fetch;

    const { result } = renderHook(() => useProfileData(mockUser));

    await waitFor(() => {
      expect(result.current.loadingData).toBe(false);
    });

    expect(result.current.stats?.eventsRegistered).toBe(2);
    expect(result.current.registrations).toHaveLength(1);
    expect(result.current.registrations[0].registeredAt.toDate()).toEqual(
      new Date("2026-04-01T12:00:00.000Z")
    );
    expect(result.current.talkSubmissions[0].submittedAt?.toDate()).toEqual(
      new Date("2026-04-02T08:00:00.000Z")
    );
    expect(result.current.profileBundle?.stats.eventsAttended).toBe(1);
    expect(result.current.connectedAgents).toEqual([
      { id: "agent-1", name: "Helper" },
    ]);
    expect(result.current.loadingAgents).toBe(false);
    expect(mockUser.getIdToken).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/profile/data",
      expect.objectContaining({
        headers: { Authorization: "Bearer profile-token" },
      })
    );
  });

  it("reconciles GitHub stats when login is present and PR count is zero", async () => {
    const reconciled: ProfileDataApiResponse = {
      ...profilePayload,
      stats: { ...profilePayload.stats, pullRequestsCount: 4 },
    };

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/profile/data?reconcileGithub=1") {
        return { ok: true, json: async () => reconciled };
      }
      if (url.startsWith("/api/profile/data")) {
        return { ok: true, json: async () => profilePayload };
      }
      if (url === "/api/agents/user") {
        return { ok: true, json: async () => ({ success: true, agents: [] }) };
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as typeof fetch;

    const { result } = renderHook(() =>
      useProfileData(mockUser, "octocat")
    );

    await waitFor(() => {
      expect(result.current.stats?.pullRequestsCount).toBe(4);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/profile/data?reconcileGithub=1",
      expect.objectContaining({
        headers: { Authorization: "Bearer profile-token" },
      })
    );
  });

  it("handles profile fetch failures gracefully", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/profile/data")) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      if (url === "/api/agents/user") {
        return { ok: true, json: async () => ({ success: true, agents: [] }) };
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as typeof fetch;

    const { result } = renderHook(() => useProfileData(mockUser));

    await waitFor(() => {
      expect(result.current.loadingData).toBe(false);
    });

    expect(result.current.stats).toBeNull();
    expect(result.current.registrations).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it("ignores agent fetch failures without blocking profile data", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/profile/data")) {
        return { ok: true, json: async () => profilePayload };
      }
      if (url === "/api/agents/user") {
        throw new Error("agents down");
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as typeof fetch;

    const { result } = renderHook(() => useProfileData(mockUser));

    await waitFor(() => {
      expect(result.current.loadingAgents).toBe(false);
    });

    expect(result.current.stats?.eventsRegistered).toBe(2);
    expect(result.current.connectedAgents).toEqual([]);
  });
});
