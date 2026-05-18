/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/certificate/mine/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));
jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));
jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;

function mineRequest() {
  return new NextRequest("http://localhost/api/certificate/mine", {
    method: "GET",
  });
}

describe("GET /api/certificate/mine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await GET(mineRequest());
    expect(res.status).toBe(401);
  });

  it("returns 500 when admin DB is not configured", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);
    mockGetAdminDb.mockReturnValue(null as any);
    const res = await GET(mineRequest());
    expect(res.status).toBe(500);
  });

  it("returns contributor and cohort winner certificates for the user", async () => {
    mockGetVerifiedUser.mockResolvedValue({ uid: "u1" } as any);

    const docs = [
      {
        id: "cert_u1",
        data: () => ({
          id: "cert_u1",
          userId: "u1",
          displayName: "Pat",
          githubLogin: "pat",
          pullRequestsCount: 12,
          issuedAt: { toDate: () => new Date("2026-04-01") },
          certName: "Cursor Boston Open Source Contributor",
          certUrl: "https://cursorboston.com/certificate/verify/cert_u1",
          kind: "contributor",
        }),
      },
      {
        id: "cert_cohort-1_week-1_u1",
        data: () => ({
          id: "cert_cohort-1_week-1_u1",
          userId: "u1",
          displayName: "Pat",
          githubLogin: "pat",
          issuedAt: { toDate: () => new Date("2026-05-18") },
          certName: "Cohort 1 Week 1 Best Project Management Tool",
          certUrl:
            "https://cursorboston.com/certificate/verify/cert_cohort-1_week-1_u1",
          kind: "cohort-winner",
          cohortId: "cohort-1",
          weekId: "week-1",
          voteCount: 9,
        }),
      },
    ];

    const db: any = {
      collection: jest.fn(() => ({
        where: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ docs }),
        })),
      })),
    };
    mockGetAdminDb.mockReturnValue(db);

    const res = await GET(mineRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.certificates).toHaveLength(2);
    expect(json.certificates[0].certificate.kind).toBe("cohort-winner");
    expect(json.certificates[0].certificate.certName).toBe(
      "Cohort 1 Week 1 Best Project Management Tool"
    );
    expect(json.certificates[0].linkedInAddToProfileUrl).toContain("linkedin.com");
    expect(json.certificates[1].certificate.kind).toBe("contributor");
  });
});
