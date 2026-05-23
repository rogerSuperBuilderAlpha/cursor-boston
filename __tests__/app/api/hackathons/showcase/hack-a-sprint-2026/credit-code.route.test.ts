/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/hackathons/showcase/hack-a-sprint-2026/credit-code/route";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  getVerifiedUser,
  isCurrentIdTokenRevoked,
} from "@/lib/server-auth";
import { resolveHackASprint2026CreditForUser } from "@/lib/hackathon-asprint-2026-credit-eligibility";

jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
  isCurrentIdTokenRevoked: jest.fn(async () => false),
}));
jest.mock("@/lib/hackathon-asprint-2026-credit-eligibility", () => ({
  resolveHackASprint2026CreditForUser: jest.fn(),
}));

const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockIsRevoked = isCurrentIdTokenRevoked as jest.MockedFunction<
  typeof isCurrentIdTokenRevoked
>;
const mockResolve = resolveHackASprint2026CreditForUser as jest.MockedFunction<
  typeof resolveHackASprint2026CreditForUser
>;

function makeReq() {
  return new NextRequest(
    "https://example.com/api/hackathons/showcase/hack-a-sprint-2026/credit-code",
    { method: "GET" },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsRevoked.mockResolvedValue(false);
});

describe("GET /api/hackathons/showcase/hack-a-sprint-2026/credit-code", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);

    const res = await GET(makeReq());

    expect(res.status).toBe(401);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("returns 401 when the sensitive credit token has been revoked", async () => {
    const db = { collection: jest.fn() };
    mockUser.mockResolvedValueOnce({ uid: "u1", email: "u@example.com" } as never);
    mockDb.mockReturnValue(db as never);
    mockResolve.mockResolvedValueOnce({
      ok: true,
      creditUrl: "https://cursor.com/credit/abc",
      rank: 7,
    } as never);
    mockIsRevoked.mockResolvedValueOnce(true);

    const res = await GET(makeReq());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Session revoked. Please sign in again.");
    expect(mockDb).toHaveBeenCalled();
    expect(mockResolve).toHaveBeenCalledWith(db, "u1", "u@example.com");
  });

  it("returns the resolved credit URL for eligible users", async () => {
    const db = { collection: jest.fn() };
    mockUser.mockResolvedValue({ uid: "u1", email: "u@example.com" } as never);
    mockDb.mockReturnValue(db as never);
    mockResolve.mockResolvedValue({
      ok: true,
      creditUrl: "https://cursor.com/credit/abc",
      rank: 7,
    } as never);

    const res = await GET(makeReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      eligible: true,
      creditUrl: "https://cursor.com/credit/abc",
      rank: 7,
    });
    expect(mockResolve).toHaveBeenCalledWith(db, "u1", "u@example.com");
  });
});
