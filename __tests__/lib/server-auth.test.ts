/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminAuth } from "@/lib/firebase-admin";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: jest.fn(),
}));

const mockGetAdminAuth = getAdminAuth as jest.MockedFunction<typeof getAdminAuth>;

function makeRequest() {
  return new NextRequest("http://localhost/api/test", {
    headers: { Authorization: "Bearer test-token" },
  });
}

describe("getVerifiedUser admin authorization bridge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_EMAILS = "legacy-admin@example.com";
    process.env.ADMIN_EMAIL = "";
  });

  it("allows admin via explicit claim", async () => {
    mockGetAdminAuth.mockReturnValue({
      verifyIdToken: jest.fn(async () => ({
        uid: "u1",
        email: "member@example.com",
        admin: true,
      })),
    } as never);

    const user = await getVerifiedUser(makeRequest());

    expect(user?.isAdmin).toBe(true);
  });

  it("allows fallback email admin when no explicit admin claim fields exist", async () => {
    mockGetAdminAuth.mockReturnValue({
      verifyIdToken: jest.fn(async () => ({
        uid: "u2",
        email: "legacy-admin@example.com",
      })),
    } as never);

    const user = await getVerifiedUser(makeRequest());

    expect(user?.isAdmin).toBe(true);
  });

  it("does not override explicit non-admin claim with fallback email", async () => {
    mockGetAdminAuth.mockReturnValue({
      verifyIdToken: jest.fn(async () => ({
        uid: "u3",
        email: "legacy-admin@example.com",
        role: "member",
      })),
    } as never);

    const user = await getVerifiedUser(makeRequest());

    expect(user?.isAdmin).toBe(false);
  });

  it("denies admin when no explicit claim and no fallback email match", async () => {
    mockGetAdminAuth.mockReturnValue({
      verifyIdToken: jest.fn(async () => ({
        uid: "u4",
        email: "member@example.com",
      })),
    } as never);

    const user = await getVerifiedUser(makeRequest());

    expect(user?.isAdmin).toBe(false);
  });
});

