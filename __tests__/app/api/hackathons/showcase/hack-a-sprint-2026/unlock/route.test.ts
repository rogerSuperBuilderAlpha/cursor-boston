/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/hackathons/showcase/hack-a-sprint-2026/unlock/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";

jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit");
  return {
    ...actual,
    getClientIdentifier: jest.fn(() => "test-ip"),
    checkRateLimit: jest.fn(() => ({ success: true, retryAfter: 0 })),
  };
});

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/hackathon-asprint-2026-schedule", () => ({
  getHackASprint2026Phase: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockPhase = getHackASprint2026Phase as jest.MockedFunction<
  typeof getHackASprint2026Phase
>;

describe("POST /api/hackathons/showcase/hack-a-sprint-2026/unlock", () => {
  const originalPass = process.env.HACK_A_SPRINT_2026_EVENT_PASSCODE;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.HACK_A_SPRINT_2026_EVENT_PASSCODE = "secret-code";
    mockPhase.mockReturnValue("passcodeUnlock");
  });

  afterAll(() => {
    process.env.HACK_A_SPRINT_2026_EVENT_PASSCODE = originalPass;
  });

  it("returns 401 when not authenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/unlock", {
      method: "POST",
      body: JSON.stringify({ passcode: "secret-code" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 on wrong passcode", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "u1@example.com",
    });
    const setMock = jest.fn().mockResolvedValue(undefined);
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(async () => ({ exists: true })),
        })),
      })),
    } as never);

    const req = new NextRequest("http://localhost/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: "wrong" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("returns 200 and writes unlock on success", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "u1@example.com",
    });
    const setMock = jest.fn().mockResolvedValue(undefined);
    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => {
        if (name === "hackathonEventSignups") {
          return {
            doc: jest.fn(() => ({
              get: jest.fn(async () => ({ exists: true })),
            })),
          };
        }
        if (name === "users") {
          return {
            doc: jest.fn(() => ({
              set: setMock,
            })),
          };
        }
        return { doc: jest.fn() };
      }),
    } as never);

    const req = new NextRequest("http://localhost/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: "secret-code" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(setMock).toHaveBeenCalled();
  });
});
