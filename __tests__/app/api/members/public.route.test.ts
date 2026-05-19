/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #67 — members/public GET route.
 */
import { GET } from "@/app/api/members/public/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { computePublicMembersSnapshot } from "@/lib/members-public-snapshot";

jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/members-public-snapshot", () => ({
  ...jest.requireActual("@/lib/members-public-snapshot"),
  computePublicMembersSnapshot: jest.fn(),
}));

const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockCompute = computePublicMembersSnapshot as jest.MockedFunction<
  typeof computePublicMembersSnapshot
>;

function setupSnapshot(opts: {
  exists?: boolean;
  data?: Record<string, unknown>;
  getThrows?: boolean;
  setThrows?: boolean;
}) {
  const setSpy = jest.fn();
  if (opts.setThrows) setSpy.mockRejectedValue(new Error("set failed"));
  else setSpy.mockResolvedValue(undefined);
  const getSpy = jest.fn();
  if (opts.getThrows) {
    getSpy.mockRejectedValue(new Error("get failed"));
  } else {
    getSpy.mockResolvedValue({
      exists: opts.exists ?? false,
      data: () => opts.data,
    });
  }
  mockDb.mockReturnValue({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({ get: getSpy, set: setSpy })),
    })),
  } as never);
  return { setSpy, getSpy };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/members/public", () => {
  it("returns empty members array when admin db is null", async () => {
    mockDb.mockReturnValue(null as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ members: [] });
  });

  it("returns the snapshot when it exists and is fresh (by expiresAt)", async () => {
    setupSnapshot({
      exists: true,
      data: {
        members: [{ uid: "u1", displayName: "Alice" }],
        expiresAt: new Date(Date.now() + 60_000), // 60s in the future
      },
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toEqual([{ uid: "u1", displayName: "Alice" }]);
    expect(mockCompute).not.toHaveBeenCalled();
  });

  it("returns the snapshot when fresh by updatedAt (no expiresAt)", async () => {
    setupSnapshot({
      exists: true,
      data: {
        members: [{ uid: "u1" }],
        updatedAt: new Date(Date.now() - 1000),
      },
    });
    const res = await GET();
    const body = await res.json();
    expect(body.members).toHaveLength(1);
    expect(mockCompute).not.toHaveBeenCalled();
  });

  it("rebuilds the snapshot when fresh-check fails (expired)", async () => {
    setupSnapshot({
      exists: true,
      data: {
        members: [{ uid: "stale" }],
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    mockCompute.mockResolvedValue([{ uid: "new" }] as never);
    const res = await GET();
    const body = await res.json();
    expect(body.members).toEqual([{ uid: "new" }]);
    expect(mockCompute).toHaveBeenCalled();
  });

  it("rebuilds when snapshot doc does not exist", async () => {
    setupSnapshot({ exists: false });
    mockCompute.mockResolvedValue([{ uid: "fresh" }] as never);
    const res = await GET();
    const body = await res.json();
    expect(body.members).toEqual([{ uid: "fresh" }]);
    expect(mockCompute).toHaveBeenCalled();
  });

  it("rebuilds when snapshot exists but members field is missing", async () => {
    setupSnapshot({ exists: true, data: { updatedAt: new Date() } });
    mockCompute.mockResolvedValue([] as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(mockCompute).toHaveBeenCalled();
  });

  it("returns fallback array if computePublicMembersSnapshot throws (and fallback was stale)", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    setupSnapshot({
      exists: true,
      data: {
        members: [{ uid: "stale-fallback" }],
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    mockCompute.mockRejectedValue(new Error("compute failed"));
    const res = await GET();
    const body = await res.json();
    expect(body.members).toEqual([{ uid: "stale-fallback" }]);
    consoleErrorSpy.mockRestore();
  });

  it("returns empty array when both fallback is empty and compute throws", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    setupSnapshot({ exists: false });
    mockCompute.mockRejectedValue(new Error("compute failed"));
    const res = await GET();
    const body = await res.json();
    expect(body.members).toEqual([]);
    consoleErrorSpy.mockRestore();
  });

  it("swallows initial get() error and tries to rebuild", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    setupSnapshot({ getThrows: true });
    mockCompute.mockResolvedValue([{ uid: "rebuilt" }] as never);
    const res = await GET();
    const body = await res.json();
    expect(body.members).toEqual([{ uid: "rebuilt" }]);
    consoleErrorSpy.mockRestore();
  });

  it("sets the Cache-Control header on success", async () => {
    setupSnapshot({
      exists: true,
      data: {
        members: [],
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toContain("public");
    expect(res.headers.get("Cache-Control")).toContain("stale-while-revalidate");
  });

  it("parses string timestamps in expiresAt/updatedAt", async () => {
    setupSnapshot({
      exists: true,
      data: {
        members: [{ uid: "u1" }],
        expiresAt: new Date(Date.now() + 60_000).toISOString(), // string
      },
    });
    const res = await GET();
    const body = await res.json();
    expect(body.members).toHaveLength(1);
  });

  it("treats invalid date string as not-fresh and rebuilds", async () => {
    setupSnapshot({
      exists: true,
      data: { members: [{ uid: "u1" }], expiresAt: "not-a-date" },
    });
    mockCompute.mockResolvedValue([{ uid: "rebuilt" }] as never);
    const res = await GET();
    const body = await res.json();
    expect(body.members).toEqual([{ uid: "rebuilt" }]);
  });
});
