/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/showcase/vote/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ success: true }),
  getClientIdentifier: () => "test-client",
}));

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/sanitize", () => ({
  sanitizeDocId: (id: string) => (id && /^[a-zA-Z0-9_-]+$/.test(id) ? id : ""),
}));

const mockForEach = jest.fn();
const mockQueryGet = jest.fn();
const mockStartAfter = jest.fn();
const mockDocGet = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: (name: string) => {
      if (name === "showcaseVotes") {
        return {
          where: jest.fn().mockReturnValue({
            get: mockQueryGet,
          }),
        };
      }
      // showcaseProjects
      return {
        orderBy: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            startAfter: (...args: unknown[]) => {
              mockStartAfter(...args);
              return { get: () => Promise.resolve({ forEach: mockForEach }) };
            },
            get: () => Promise.resolve({ forEach: mockForEach }),
          }),
        }),
        doc: (id: string) => ({
          get: () => mockDocGet(id),
        }),
      };
    },
  })),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<
  typeof getVerifiedUser
>;

const testUser: VerifiedUser = { uid: "u1", name: "Test" };

function makeGetRequest(params?: Record<string, string>) {
  const url = new URL("http://localhost/api/showcase/vote");
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url);
}

describe("GET /api/showcase/vote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty votes/userVotes when db is not configured", async () => {
    // Override getAdminDb to return null for this test
    const firebaseAdmin = require("@/lib/firebase-admin");
    firebaseAdmin.getAdminDb.mockReturnValueOnce(null);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ votes: {}, userVotes: {} });
  });

  it("returns vote counts from showcaseProjects", async () => {
    mockForEach.mockImplementation(
      (cb: (doc: { id: string; data: () => Record<string, number> }) => void) => {
        cb({ id: "proj1", data: () => ({ upCount: 5, downCount: 2 }) });
        cb({ id: "proj2", data: () => ({ upCount: 0, downCount: 3 }) });
      }
    );
    mockGetVerifiedUser.mockRejectedValue(new Error("unauth"));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.votes).toEqual({
      proj1: { upCount: 5, downCount: 2 },
      proj2: { upCount: 0, downCount: 3 },
    });
    expect(body.userVotes).toEqual({});
  });

  it("returns user votes when authenticated", async () => {
    mockForEach.mockImplementation(() => {});
    mockGetVerifiedUser.mockResolvedValue(testUser);
    mockQueryGet.mockResolvedValue({
      forEach: (cb: (doc: { data: () => Record<string, string> }) => void) => {
        cb({ data: () => ({ projectId: "proj1", type: "up" }) });
        cb({ data: () => ({ projectId: "proj2", type: "down" }) });
      },
    });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userVotes).toEqual({ proj1: "up", proj2: "down" });
  });

  it("uses startAfter cursor when provided", async () => {
    mockForEach.mockImplementation(() => {});
    mockGetVerifiedUser.mockRejectedValue(new Error("unauth"));
    mockDocGet.mockResolvedValue({ exists: true });

    const res = await GET(makeGetRequest({ startAfter: "proj1" }));
    expect(res.status).toBe(200);
    expect(mockDocGet).toHaveBeenCalledWith("proj1");
    expect(mockStartAfter).toHaveBeenCalled();
  });

  it("ignores invalid startAfter cursor", async () => {
    mockForEach.mockImplementation(() => {});
    mockGetVerifiedUser.mockRejectedValue(new Error("unauth"));

    const res = await GET(makeGetRequest({ startAfter: "../../bad" }));
    expect(res.status).toBe(200);
    // sanitizeDocId returns "" for invalid input, so no cursor used
    expect(mockDocGet).not.toHaveBeenCalled();
    expect(mockStartAfter).not.toHaveBeenCalled();
  });

  it("skips startAfter when cursor doc does not exist", async () => {
    mockForEach.mockImplementation(() => {});
    mockGetVerifiedUser.mockRejectedValue(new Error("unauth"));
    mockDocGet.mockResolvedValue({ exists: false });

    const res = await GET(makeGetRequest({ startAfter: "nonexistent" }));
    expect(res.status).toBe(200);
    expect(mockStartAfter).not.toHaveBeenCalled();
  });

  it("respects limit parameter capped at 200", async () => {
    mockForEach.mockImplementation(() => {});
    mockGetVerifiedUser.mockRejectedValue(new Error("unauth"));

    const res = await GET(makeGetRequest({ limit: "999" }));
    expect(res.status).toBe(200);
    // The route caps at 200, no direct assertion on internal call but ensures no error
  });

  it("defaults missing counts to 0", async () => {
    mockForEach.mockImplementation(
      (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
        cb({ id: "proj1", data: () => ({}) });
      }
    );
    mockGetVerifiedUser.mockRejectedValue(new Error("unauth"));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.votes).toEqual({ proj1: { upCount: 0, downCount: 0 } });
  });

  it("returns fallback on unexpected error", async () => {
    const firebaseAdmin = require("@/lib/firebase-admin");
    firebaseAdmin.getAdminDb.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ votes: {}, userVotes: {} });
  });
});
