/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/events/pydata-2026/luma-status/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { PYDATA_2026_LUMA_EVENT_NAME } from "@/lib/pydata-2026";

jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/middleware", () => ({
  withMiddleware: (_cfg: unknown, handler: any) => handler,
  rateLimitConfigs: { standard: {} },
}));

const mockAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;

function buildDb(eventContactsDoc: { exists: boolean; data?: Record<string, unknown> }) {
  const docRef = {
    get: jest.fn().mockResolvedValue({
      exists: eventContactsDoc.exists,
      data: () => eventContactsDoc.data,
    }),
  };
  const db: any = {
    collection: jest.fn(() => ({ doc: jest.fn(() => docRef) })),
  };
  return { db };
}

function req() {
  return new NextRequest("http://localhost/api/events/pydata-2026/luma-status", {
    method: "GET",
  });
}

describe("GET /api/events/pydata-2026/luma-status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns signedIn:false when no user is authenticated", async () => {
    mockUser.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ signedIn: false, onLumaList: false });
  });

  it("returns onLumaList:false when the user has no email", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "" } as any);
    const res = await GET(req());
    expect(await res.json()).toEqual({ signedIn: true, onLumaList: false });
  });

  it("returns 500 when admin DB is not configured", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "a@b.com" } as any);
    mockAdminDb.mockReturnValue(null as any);
    const res = await GET(req());
    expect(res.status).toBe(500);
  });

  it("returns onLumaList:false when no eventContacts doc exists for the email", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "a@b.com" } as any);
    const { db } = buildDb({ exists: false });
    mockAdminDb.mockReturnValue(db);
    const res = await GET(req());
    expect(await res.json()).toEqual({ signedIn: true, onLumaList: false });
  });

  it("returns onLumaList:true when the eventContacts doc lists the PyData luma event", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "a@b.com" } as any);
    const { db } = buildDb({
      exists: true,
      data: { eventNames: [PYDATA_2026_LUMA_EVENT_NAME, "Other event"] },
    });
    mockAdminDb.mockReturnValue(db);
    const json = await (await GET(req())).json();
    expect(json).toEqual({ signedIn: true, onLumaList: true });
  });

  it("returns onLumaList:false when eventContacts doc has other events but not pydata", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "a@b.com" } as any);
    const { db } = buildDb({
      exists: true,
      data: { eventNames: ["Some other event"] },
    });
    mockAdminDb.mockReturnValue(db);
    const json = await (await GET(req())).json();
    expect(json.onLumaList).toBe(false);
  });

  it("returns onLumaList:false when eventNames is not an array", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "a@b.com" } as any);
    const { db } = buildDb({ exists: true, data: { eventNames: "not-array" } });
    mockAdminDb.mockReturnValue(db);
    const json = await (await GET(req())).json();
    expect(json.onLumaList).toBe(false);
  });

  it("normalizes email to lowercase for the eventContacts lookup", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "  ALICE@Example.com  " } as any);
    const docRef = {
      get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
    };
    const docFn = jest.fn(() => docRef);
    const db: any = { collection: jest.fn(() => ({ doc: docFn })) };
    mockAdminDb.mockReturnValue(db);

    await GET(req());
    expect(docFn).toHaveBeenCalledWith("alice@example.com");
  });
});
