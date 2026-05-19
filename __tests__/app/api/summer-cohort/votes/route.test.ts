/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage push #74 — summer-cohort votes API.
 */
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/summer-cohort/votes/route";
import { getVerifiedUser } from "@/lib/server-auth";
import type { VerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

const mockVotesGet = jest.fn();
const mockVoteDocGet = jest.fn();
const mockVoteDocSet = jest.fn().mockResolvedValue(undefined);
const mockVoteDocDelete = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: (name: string) => {
      if (name !== "summerCohortVotes") {
        return { doc: jest.fn(), where: jest.fn() };
      }
      const voteQuery = {
        where: jest.fn().mockReturnThis(),
        get: mockVotesGet,
      };
      return {
        where: () => voteQuery,
        doc: () => ({
          get: mockVoteDocGet,
          set: mockVoteDocSet,
          delete: mockVoteDocDelete,
        }),
      };
    },
  })),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<
  typeof getVerifiedUser
>;

const voter: VerifiedUser = {
  uid: "voter-1",
  email: "v@example.com",
  name: "Voter",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetVerifiedUser.mockResolvedValue(null);
  mockVotesGet.mockResolvedValue({ docs: [] });
  mockVoteDocGet.mockResolvedValue({ exists: false });
});

describe("GET /api/summer-cohort/votes", () => {
  it("returns 400 when weekId is missing", async () => {
    const req = new NextRequest("http://localhost/api/summer-cohort/votes");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns empty counts when no votes exist", async () => {
    const req = new NextRequest(
      "http://localhost/api/summer-cohort/votes?weekId=week-1",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.weekId).toBe("week-1");
    expect(body.counts).toEqual({});
    expect(body.authenticated).toBe(false);
  });

  it("aggregates vote counts and myVotes for signed-in user", async () => {
    mockGetVerifiedUser.mockResolvedValue(voter);
    mockVotesGet.mockResolvedValue({
      docs: [
        {
          data: () => ({
            weekId: "week-1",
            submitterHandle: "alice",
            voterUid: "voter-1",
          }),
        },
        {
          data: () => ({
            weekId: "week-1",
            submitterHandle: "alice",
            voterUid: "other",
          }),
        },
        {
          data: () => ({
            weekId: "week-1",
            submitterHandle: "bob",
            voterUid: "voter-1",
          }),
        },
      ],
    });

    const req = new NextRequest(
      "http://localhost/api/summer-cohort/votes?weekId=week-1",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(body.counts).toEqual({ alice: 2, bob: 1 });
    expect(body.myVotes).toEqual(expect.arrayContaining(["alice", "bob"]));
    expect(body.authenticated).toBe(true);
  });
});

describe("POST /api/summer-cohort/votes", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/summer-cohort/votes", {
      method: "POST",
      body: JSON.stringify({ weekId: "week-1", submitterHandle: "alice" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    mockGetVerifiedUser.mockResolvedValue(voter);
    const req = new NextRequest("http://localhost/api/summer-cohort/votes", {
      method: "POST",
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates a vote when none exists", async () => {
    mockGetVerifiedUser.mockResolvedValue(voter);
    mockVoteDocGet.mockResolvedValue({ exists: false });

    const req = new NextRequest("http://localhost/api/summer-cohort/votes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weekId: "week-1", submitterHandle: "alice" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.voted).toBe(true);
    expect(mockVoteDocSet).toHaveBeenCalled();
  });

  it("removes a vote when one already exists", async () => {
    mockGetVerifiedUser.mockResolvedValue(voter);
    mockVoteDocGet.mockResolvedValue({ exists: true });

    const req = new NextRequest("http://localhost/api/summer-cohort/votes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weekId: "week-1", submitterHandle: "alice" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.voted).toBe(false);
    expect(mockVoteDocDelete).toHaveBeenCalled();
  });
});
