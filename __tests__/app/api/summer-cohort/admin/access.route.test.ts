/**
 * @jest-environment node
 */

import { GET } from "@/app/api/summer-cohort/admin/access/route";
import {
  getVerifiedUserWithRevocation,
  isRevokedIdTokenError,
} from "@/lib/server-auth";
import { isSummerCohortAdminEmail } from "@/lib/summer-cohort-admin-access";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUserWithRevocation: jest.fn(),
  isRevokedIdTokenError: jest.fn(() => false),
}));
jest.mock("@/lib/summer-cohort-admin-access", () => ({
  isSummerCohortAdminEmail: jest.fn(),
}));

const mockUser = getVerifiedUserWithRevocation as jest.MockedFunction<
  typeof getVerifiedUserWithRevocation
>;
const mockIsRevoked = isRevokedIdTokenError as jest.MockedFunction<
  typeof isRevokedIdTokenError
>;
const mockIsAdminEmail = isSummerCohortAdminEmail as jest.MockedFunction<
  typeof isSummerCohortAdminEmail
>;

describe("GET /api/summer-cohort/admin/access", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsRevoked.mockReturnValue(false);
    mockIsAdminEmail.mockReturnValue(false);
  });

  it("returns allowed false when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);

    const { status, body } = await readJson(
      await GET(makeRequest({ path: "/api/summer-cohort/admin/access" })),
    );

    expect(status).toBe(401);
    expect(body).toEqual({ allowed: false });
  });

  it("treats malformed or expired tokens as an unauthenticated probe", async () => {
    mockUser.mockRejectedValueOnce(new Error("token expired") as never);

    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ path: "/api/summer-cohort/admin/access" })),
    );

    expect(status).toBe(401);
    expect(body).toEqual({ allowed: false });
    expect(mockIsAdminEmail).not.toHaveBeenCalled();
  });

  it("returns an explicit revoked-session error for revoked tokens", async () => {
    mockUser.mockRejectedValueOnce(new Error("revoked") as never);
    mockIsRevoked.mockReturnValueOnce(true);

    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ path: "/api/summer-cohort/admin/access" })),
    );

    expect(status).toBe(401);
    expect(body).toEqual({
      allowed: false,
      error: "Session revoked. Please sign in again.",
    });
    expect(mockIsAdminEmail).not.toHaveBeenCalled();
  });

  it("returns the admin-email gate result for authenticated users", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "admin@example.com" } as never);
    mockIsAdminEmail.mockReturnValue(true);

    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ path: "/api/summer-cohort/admin/access" })),
    );

    expect(status).toBe(200);
    expect(body).toEqual({ allowed: true });
    expect(mockIsAdminEmail).toHaveBeenCalledWith("admin@example.com");
  });
});
