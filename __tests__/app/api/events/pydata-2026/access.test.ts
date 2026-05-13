/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/events/pydata-2026/access/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";

jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/middleware", () => ({
  withMiddleware: (_cfg: unknown, handler: any) => handler,
  rateLimitConfigs: { standard: {} },
}));

const mockAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;

/**
 * Build a Firestore mock for the access route. The route reads:
 *  - pydata2026Registrations/{uid}  (the registration form may have a different email)
 *  - users/{uid}                    (for additionalEmails)
 *  - pydataHack2026AccessList/{email}  (the door list)
 */
function buildDb(opts: {
  registration?: { exists: boolean; data?: Record<string, unknown> };
  userDoc?: { exists: boolean; data?: Record<string, unknown> };
  /** Set of access-list emails that exist. */
  accessListEmails?: Set<string>;
}) {
  const regDoc = {
    get: jest.fn().mockResolvedValue({
      exists: opts.registration?.exists ?? false,
      data: () => opts.registration?.data,
    }),
  };
  const userDocRef = {
    get: jest.fn().mockResolvedValue({
      exists: opts.userDoc?.exists ?? false,
      data: () => opts.userDoc?.data,
    }),
  };
  const accessListEmails = opts.accessListEmails ?? new Set<string>();
  const accessListDocFor = (email: string) => ({
    get: jest.fn().mockResolvedValue({ exists: accessListEmails.has(email) }),
  });

  const db: any = {
    collection: jest.fn((name: string) => {
      if (name === "pydataHack2026Registrations")
        return { doc: jest.fn(() => regDoc) };
      if (name === "users")
        return { doc: jest.fn(() => userDocRef) };
      if (name === "pydataHack2026AccessList") {
        return { doc: jest.fn((email: string) => accessListDocFor(email)) };
      }
      return { doc: jest.fn() };
    }),
  };
  return { db };
}

function req() {
  return new NextRequest("http://localhost/api/events/pydata-2026/access", {
    method: "GET",
  });
}

describe("GET /api/events/pydata-2026/access", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns allowed:false with reason 'unauthenticated' when no user", async () => {
    mockUser.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ allowed: false, reason: "unauthenticated" });
  });

  it("returns 500 when admin DB is not configured", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "a@b.com" } as any);
    mockAdminDb.mockReturnValue(null as any);
    const res = await GET(req());
    expect(res.status).toBe(500);
  });

  it("returns allowed:false when no candidate emails are produced", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "" } as any);
    const { db } = buildDb({}); // empty registration, empty user doc
    mockAdminDb.mockReturnValue(db);
    const json = await (await GET(req())).json();
    expect(json).toEqual({ allowed: false });
  });

  it("returns allowed:true when the auth email is on the access list", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "a@b.com" } as any);
    const { db } = buildDb({
      accessListEmails: new Set(["a@b.com"]),
    });
    mockAdminDb.mockReturnValue(db);
    const json = await (await GET(req())).json();
    expect(json).toEqual({ allowed: true });
  });

  it("returns allowed:true when the registration email is on the list (different from auth email)", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "school@edu.com" } as any);
    const { db } = buildDb({
      registration: { exists: true, data: { email: "personal@example.com" } },
      accessListEmails: new Set(["personal@example.com"]),
    });
    mockAdminDb.mockReturnValue(db);
    const json = await (await GET(req())).json();
    expect(json.allowed).toBe(true);
  });

  it("returns allowed:true when a verified additional email is on the list", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "primary@example.com" } as any);
    const { db } = buildDb({
      userDoc: {
        exists: true,
        data: {
          additionalEmails: [
            { email: "additional@example.com", verified: true },
            { email: "unverified@example.com", verified: false },
          ],
        },
      },
      accessListEmails: new Set(["additional@example.com"]),
    });
    mockAdminDb.mockReturnValue(db);
    const json = await (await GET(req())).json();
    expect(json.allowed).toBe(true);
  });

  it("ignores unverified additional emails", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "primary@example.com" } as any);
    const { db } = buildDb({
      userDoc: {
        exists: true,
        data: {
          additionalEmails: [
            { email: "unverified@example.com", verified: false },
          ],
        },
      },
      accessListEmails: new Set(["unverified@example.com"]), // would match, but unverified
    });
    mockAdminDb.mockReturnValue(db);
    const json = await (await GET(req())).json();
    expect(json.allowed).toBe(false);
  });

  it("returns allowed:false when none of the candidates are on the list", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "a@b.com" } as any);
    const { db } = buildDb({
      registration: { exists: true, data: { email: "form@example.com" } },
      accessListEmails: new Set(["someone-else@example.com"]),
    });
    mockAdminDb.mockReturnValue(db);
    const json = await (await GET(req())).json();
    expect(json.allowed).toBe(false);
  });
});
