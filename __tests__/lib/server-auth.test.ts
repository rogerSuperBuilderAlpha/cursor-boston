/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { getVerifiedUser, getOptionalVerifiedUser } from "@/lib/server-auth";
import { getAdminAuth } from "@/lib/firebase-admin";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminAuth: jest.fn(),
}));

const mockGetAdminAuth = getAdminAuth as jest.MockedFunction<typeof getAdminAuth>;

function makeRequest(headers: Record<string, string> = { Authorization: "Bearer test-token" }) {
  return new NextRequest("http://localhost/api/test", { headers });
}

function mockVerify(returnValue: Record<string, unknown>) {
  mockGetAdminAuth.mockReturnValue({
    verifyIdToken: jest.fn(async () => returnValue),
  } as never);
}

describe("getVerifiedUser admin authorization bridge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_EMAILS = "legacy-admin@example.com";
    process.env.ADMIN_EMAIL = "";
  });

  it("allows admin via explicit claim", async () => {
    mockVerify({ uid: "u1", email: "member@example.com", admin: true });
    const user = await getVerifiedUser(makeRequest());
    expect(user?.isAdmin).toBe(true);
  });

  it("allows fallback email admin when no explicit admin claim fields exist", async () => {
    mockVerify({ uid: "u2", email: "legacy-admin@example.com" });
    const user = await getVerifiedUser(makeRequest());
    expect(user?.isAdmin).toBe(true);
  });

  it("does not override explicit non-admin claim with fallback email", async () => {
    mockVerify({ uid: "u3", email: "legacy-admin@example.com", role: "member" });
    const user = await getVerifiedUser(makeRequest());
    expect(user?.isAdmin).toBe(false);
  });

  it("denies admin when no explicit claim and no fallback email match", async () => {
    mockVerify({ uid: "u4", email: "member@example.com" });
    const user = await getVerifiedUser(makeRequest());
    expect(user?.isAdmin).toBe(false);
  });

  // OpenSSF Gold coverage push #11 — broader branch coverage

  it("returns null when no Authorization or x-firebase-id-token header is present", async () => {
    const req = new NextRequest("http://localhost/api/test");
    const user = await getVerifiedUser(req);
    expect(user).toBeNull();
    expect(mockGetAdminAuth).not.toHaveBeenCalled();
  });

  it("accepts token from x-firebase-id-token header when no Bearer", async () => {
    mockVerify({ uid: "u5", email: "member@example.com" });
    const user = await getVerifiedUser(
      makeRequest({ "x-firebase-id-token": "alt-token" }),
    );
    expect(user?.uid).toBe("u5");
  });

  it("Bearer header takes precedence over x-firebase-id-token", async () => {
    const verifyFn = jest.fn(async () => ({ uid: "primary", email: "x@y" }));
    mockGetAdminAuth.mockReturnValue({ verifyIdToken: verifyFn } as never);
    await getVerifiedUser(
      makeRequest({
        Authorization: "Bearer primary-token",
        "x-firebase-id-token": "alt-token",
      }),
    );
    expect(verifyFn).toHaveBeenCalledWith("primary-token", false);
  });

  it("throws when Firebase Admin Auth is not configured", async () => {
    mockGetAdminAuth.mockReturnValue(null as never);
    await expect(getVerifiedUser(makeRequest())).rejects.toThrow(
      "Firebase Admin Auth is not configured",
    );
  });

  it("hasAdminClaim: isAdmin=true grants admin", async () => {
    mockVerify({ uid: "u6", email: "x", isAdmin: true });
    const user = await getVerifiedUser(makeRequest());
    expect(user?.isAdmin).toBe(true);
  });

  it("hasAdminClaim: role='admin' grants admin", async () => {
    mockVerify({ uid: "u7", email: "x", role: "admin" });
    const user = await getVerifiedUser(makeRequest());
    expect(user?.isAdmin).toBe(true);
    expect(user?.role).toBe("admin");
  });

  it("hasAdminClaim: roles array containing 'admin' grants admin", async () => {
    mockVerify({ uid: "u8", email: "x", roles: ["editor", "admin"] });
    const user = await getVerifiedUser(makeRequest());
    expect(user?.isAdmin).toBe(true);
    expect(user?.roles).toEqual(["editor", "admin"]);
  });

  it("hasAdminClaim: roles array without 'admin' does not grant admin", async () => {
    mockVerify({ uid: "u9", email: "x", roles: ["editor"] });
    const user = await getVerifiedUser(makeRequest());
    expect(user?.isAdmin).toBe(false);
  });

  it("toStringArray filters non-string entries from roles", async () => {
    mockVerify({ uid: "u10", email: "x", roles: ["editor", 123, null, "admin"] });
    const user = await getVerifiedUser(makeRequest());
    expect(user?.roles).toEqual(["editor", "admin"]);
    expect(user?.isAdmin).toBe(true);
  });

  it("toStringArray returns empty array when roles is not an array", async () => {
    mockVerify({ uid: "u11", email: "x", roles: "admin" });
    const user = await getVerifiedUser(makeRequest());
    expect(user?.roles).toEqual([]);
    expect(user?.isAdmin).toBe(false);
  });

  it("falls back to ADMIN_EMAIL env when ADMIN_EMAILS is empty", async () => {
    process.env.ADMIN_EMAILS = "";
    process.env.ADMIN_EMAIL = "single-admin@example.com";
    mockVerify({ uid: "u12", email: "single-admin@example.com" });
    const user = await getVerifiedUser(makeRequest());
    expect(user?.isAdmin).toBe(true);
  });

  it("legacy admin email match is case-insensitive and trims whitespace", async () => {
    process.env.ADMIN_EMAILS = " UPPER@Example.com , other@example.com ";
    mockVerify({ uid: "u13", email: "upper@example.com" });
    const user = await getVerifiedUser(makeRequest());
    expect(user?.isAdmin).toBe(true);
  });

  it("returns full user shape including name/picture passthrough", async () => {
    mockVerify({
      uid: "u14",
      email: "x@y",
      name: "Test User",
      picture: "https://example.com/avatar.png",
    });
    const user = await getVerifiedUser(makeRequest());
    expect(user).toMatchObject({
      uid: "u14",
      name: "Test User",
      picture: "https://example.com/avatar.png",
    });
  });

  it("ignores empty Bearer token (whitespace only)", async () => {
    const user = await getVerifiedUser(makeRequest({ Authorization: "Bearer    " }));
    // The regex `^Bearer\s+(.+)$` requires at least one non-whitespace char,
    // so a Bearer with only whitespace doesn't match — falls through to
    // null. (The fallthrough is the documented behavior.)
    expect(user).toBeNull();
  });
});

describe("getOptionalVerifiedUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_EMAILS = "legacy-admin@example.com";
    process.env.ADMIN_EMAIL = "";
  });

  it("returns null when no token is present", async () => {
    const req = new NextRequest("http://localhost/api/test");
    const user = await getOptionalVerifiedUser(req);
    expect(user).toBeNull();
  });

  it("returns null (NOT throws) when admin auth is not configured", async () => {
    mockGetAdminAuth.mockReturnValue(null as never);
    const user = await getOptionalVerifiedUser(makeRequest());
    expect(user).toBeNull();
  });

  it("returns null when verifyIdToken throws (invalid/expired token)", async () => {
    mockGetAdminAuth.mockReturnValue({
      verifyIdToken: jest.fn(async () => {
        throw new Error("token expired");
      }),
    } as never);
    const user = await getOptionalVerifiedUser(makeRequest());
    expect(user).toBeNull();
  });

  it("returns the verified user on success", async () => {
    mockVerify({ uid: "opt-1", email: "x@y", admin: true });
    const user = await getOptionalVerifiedUser(makeRequest());
    expect(user?.uid).toBe("opt-1");
    expect(user?.isAdmin).toBe(true);
  });

  it("derives admin via legacy email fallback for optional path too", async () => {
    mockVerify({ uid: "opt-2", email: "legacy-admin@example.com" });
    const user = await getOptionalVerifiedUser(makeRequest());
    expect(user?.isAdmin).toBe(true);
  });

  it("denies admin when explicit non-admin claim exists for optional path", async () => {
    mockVerify({
      uid: "opt-3",
      email: "legacy-admin@example.com",
      role: "member",
    });
    const user = await getOptionalVerifiedUser(makeRequest());
    expect(user?.isAdmin).toBe(false);
  });

  it("accepts x-firebase-id-token in the optional path", async () => {
    mockVerify({ uid: "opt-4", email: "x@y" });
    const user = await getOptionalVerifiedUser(
      makeRequest({ "x-firebase-id-token": "alt" }),
    );
    expect(user?.uid).toBe("opt-4");
  });
});

