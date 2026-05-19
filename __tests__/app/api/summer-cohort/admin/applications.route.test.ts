/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #17 — summer-cohort admin applications route.
 */
import { GET } from "@/app/api/summer-cohort/admin/applications/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { isSummerCohortAdminEmail } from "@/lib/summer-cohort-admin-access";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/summer-cohort-admin-access", () => ({
  isSummerCohortAdminEmail: jest.fn(),
}));

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockIsAdmin = isSummerCohortAdminEmail as jest.MockedFunction<typeof isSummerCohortAdminEmail>;

function fakeQuery(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const query = {
    where: jest.fn(() => query),
    get: jest.fn().mockResolvedValue({
      docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
    }),
  };
  return query;
}

function setupDb(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const query = fakeQuery(docs);
  mockDb.mockReturnValue({
    collection: jest.fn(() => query),
  } as never);
  return { query };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAdmin.mockReturnValue(true);
});

describe("GET /api/summer-cohort/admin/applications", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);
    const { status, body } = await readJson(
      await GET(makeRequest({ method: "GET", path: "/api/summer-cohort/admin/applications" })),
    );
    expect(status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when user is not a cohort admin", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    mockIsAdmin.mockReturnValue(false);
    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ method: "GET", path: "/api/summer-cohort/admin/applications" })),
    );
    expect(status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("returns 500 when admin db is missing", async () => {
    mockUser.mockResolvedValue({ uid: "admin", email: "admin@x" } as never);
    mockDb.mockReturnValue(null as never);
    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ method: "GET", path: "/api/summer-cohort/admin/applications" })),
    );
    expect(status).toBe(500);
    expect(body.error).toContain("Server not configured");
  });

  it("returns 400 for invalid query parameters", async () => {
    mockUser.mockResolvedValue({ uid: "admin", email: "admin@x" } as never);
    setupDb([]);
    const { status } = await readJson(
      await GET(
        makeAuthedRequest({
          method: "GET",
          path: "/api/summer-cohort/admin/applications",
          searchParams: { cohortId: "not-a-valid-cohort" },
        }),
      ),
    );
    expect(status).toBe(400);
  });

  it("returns 200 with all applications sorted by createdAt desc", async () => {
    mockUser.mockResolvedValue({ uid: "admin", email: "admin@x" } as never);
    setupDb([
      {
        id: "u1",
        data: {
          email: "alice@x",
          name: "Alice",
          phone: "555-1",
          cohorts: ["cohort-1", "invalid"],
          status: "pending",
          isLocal: true,
          wantsToPresent: false,
          createdAt: { toMillis: () => 1000 },
          updatedAt: { toMillis: () => 2000 },
        },
      },
      {
        id: "u2",
        data: {
          email: "bob@x",
          name: "Bob",
          phone: null,
          cohorts: ["cohort-2"],
          status: "admitted",
          createdAt: { toMillis: () => 3000 },
          updatedAt: { toMillis: () => 4000 },
        },
      },
    ]);
    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ method: "GET", path: "/api/summer-cohort/admin/applications" })),
    );
    expect(status).toBe(200);
    expect(body.total).toBe(2);
    // Sorted desc — bob (3000) first
    expect(body.applications[0].userId).toBe("u2");
    expect(body.applications[1].userId).toBe("u1");
    // Invalid cohort entries filtered out
    expect(body.applications[1].cohorts).toEqual(["cohort-1"]);
  });

  it("filters by cohortId via array-contains", async () => {
    mockUser.mockResolvedValue({ uid: "admin", email: "admin@x" } as never);
    const { query } = setupDb([]);
    await GET(
      makeAuthedRequest({
        method: "GET",
        path: "/api/summer-cohort/admin/applications",
        searchParams: { cohortId: "cohort-1" },
      }),
    );
    expect(query.where).toHaveBeenCalledWith("cohorts", "array-contains", "cohort-1");
  });

  it("filters by status via equality", async () => {
    mockUser.mockResolvedValue({ uid: "admin", email: "admin@x" } as never);
    const { query } = setupDb([]);
    await GET(
      makeAuthedRequest({
        method: "GET",
        path: "/api/summer-cohort/admin/applications",
        searchParams: { status: "admitted" },
      }),
    );
    expect(query.where).toHaveBeenCalledWith("status", "==", "admitted");
  });

  it("defaults invalid status field to 'pending' and missing optional fields to null", async () => {
    mockUser.mockResolvedValue({ uid: "admin", email: "admin@x" } as never);
    setupDb([
      {
        id: "u3",
        data: {
          status: "not-a-valid-status",
          // No cohorts (not an array)
          cohorts: "not-array",
        },
      },
    ]);
    const { body } = await readJson(
      await GET(makeAuthedRequest({ method: "GET", path: "/api/summer-cohort/admin/applications" })),
    );
    expect(body.applications[0]).toMatchObject({
      status: "pending",
      cohorts: [],
      email: null,
      name: null,
      phone: null,
      isLocal: null,
      wantsToPresent: null,
      createdAt: null,
      updatedAt: null,
    });
  });
});
