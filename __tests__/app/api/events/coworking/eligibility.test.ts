/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/events/[eventId]/coworking/eligibility/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { checkCoworkingEligibility } from "@/lib/coworking";
import { checkRateLimit } from "@/lib/rate-limit";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/coworking", () => ({
  checkCoworkingEligibility: jest.fn(),
}));
jest.mock("@/lib/rate-limit", () => ({
  ...jest.requireActual("@/lib/rate-limit"),
  checkRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => "ip:127.0.0.1"),
}));

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockEligibility = checkCoworkingEligibility as jest.MockedFunction<
  typeof checkCoworkingEligibility
>;
const mockRate = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

function req() {
  return new NextRequest("http://localhost/api/events/e1/coworking/eligibility", {
    method: "GET",
  });
}

describe("GET /api/events/[eventId]/coworking/eligibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRate.mockReturnValue({ success: true } as any);
  });

  it("returns 429 when rate-limited", async () => {
    mockRate.mockReturnValue({ success: false, retryAfter: 30 } as any);
    const res = await GET(req());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });

  it("returns eligible:false with a sign-in prompt when no user", async () => {
    mockUser.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.eligible).toBe(false);
    expect(json.reason).toContain("sign in");
  });

  it("returns the result of checkCoworkingEligibility when user is signed in", async () => {
    mockUser.mockResolvedValue({ uid: "u1" } as any);
    mockEligibility.mockResolvedValue({
      eligible: true,
      reason: "All requirements met",
    } as any);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ eligible: true, reason: "All requirements met" });
    expect(mockEligibility).toHaveBeenCalledWith("u1");
  });

  it("returns a safe fallback (eligible:false, 200) when the eligibility check throws", async () => {
    mockUser.mockResolvedValue({ uid: "u1" } as any);
    mockEligibility.mockRejectedValue(new Error("firestore-down"));
    const res = await GET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.eligible).toBe(false);
    expect(json.reason).toContain("Could not check");
  });
});
