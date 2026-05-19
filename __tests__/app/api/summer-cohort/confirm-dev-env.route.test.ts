/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #17 — summer-cohort confirm-dev-env route.
 */
import { POST } from "@/app/api/summer-cohort/confirm-dev-env/route";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/middleware", () => ({
  withMiddleware: (_config: unknown, handler: (req: unknown) => unknown) => handler,
  rateLimitConfigs: { standard: {} },
}));
jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: jest.fn(() => "TS") },
}));

const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

function makeAppRef(opts: {
  exists?: boolean;
  data?: unknown;
  refreshedData?: unknown;
}) {
  const updateSpy = jest.fn().mockResolvedValue(undefined);
  const getSpy = jest
    .fn()
    .mockResolvedValueOnce({
      exists: opts.exists ?? true,
      data: () => opts.data,
    })
    .mockResolvedValueOnce({
      exists: true,
      data: () => opts.refreshedData,
    });
  return { updateSpy, getSpy, ref: { update: updateSpy, get: getSpy } };
}

function setupDb(ref: { update: jest.Mock; get: jest.Mock }) {
  mockDb.mockReturnValue({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ref),
    })),
  } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/summer-cohort/confirm-dev-env", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValue(null);
    const { status, body } = await readJson(
      await POST(makeRequest({ method: "POST", path: "/api/summer-cohort/confirm-dev-env" })),
    );
    expect(status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 500 when admin db is missing", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    mockDb.mockReturnValue(null as never);
    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: "/api/summer-cohort/confirm-dev-env" })),
    );
    expect(status).toBe(500);
    expect(body.error).toContain("Server not configured");
  });

  it("returns 403 when no application exists for user", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    const { ref } = makeAppRef({ exists: false });
    setupDb(ref);
    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: "/api/summer-cohort/confirm-dev-env" })),
    );
    expect(status).toBe(403);
    expect(body.error).toContain("No application on file");
  });

  it("returns 403 when application status is not 'admitted'", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    const { ref } = makeAppRef({
      exists: true,
      data: { status: "pending", cohorts: ["c1"] },
    });
    setupDb(ref);
    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: "/api/summer-cohort/confirm-dev-env" })),
    );
    expect(status).toBe(403);
    expect(body.error).toContain("admitted cohort applicants");
  });

  it("returns 403 when admitted but cohorts array is empty", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    const { ref } = makeAppRef({
      exists: true,
      data: { status: "admitted", cohorts: [] },
    });
    setupDb(ref);
    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: "/api/summer-cohort/confirm-dev-env" })),
    );
    expect(status).toBe(403);
    expect(body.error).toContain("admitted cohort applicants");
  });

  it("returns 403 when status field is missing entirely (defaults to 'pending')", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    const { ref } = makeAppRef({
      exists: true,
      data: { cohorts: ["c1"] },
    });
    setupDb(ref);
    const { status } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: "/api/summer-cohort/confirm-dev-env" })),
    );
    expect(status).toBe(403);
  });

  it("stamps timestamp and returns 200 with toMillis result on success", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    const { ref, updateSpy } = makeAppRef({
      exists: true,
      data: { status: "admitted", cohorts: ["c1"] },
      refreshedData: {
        cohort1DevEnvConfirmedAt: { toMillis: () => 1717000000000 },
      },
    });
    setupDb(ref);
    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: "/api/summer-cohort/confirm-dev-env" })),
    );
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.cohort1DevEnvConfirmedAt).toBe(1717000000000);
    expect(updateSpy).toHaveBeenCalledWith({
      cohort1DevEnvConfirmedAt: "TS",
      updatedAt: "TS",
    });
  });

  it("falls back to Date.now() millis when the stamp lacks toMillis()", async () => {
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    const { ref } = makeAppRef({
      exists: true,
      data: { status: "admitted", cohorts: ["c1"] },
      refreshedData: {
        // No toMillis function — falls through to Date.now()
        cohort1DevEnvConfirmedAt: null,
      },
    });
    setupDb(ref);
    const { status, body } = await readJson(
      await POST(makeAuthedRequest({ method: "POST", path: "/api/summer-cohort/confirm-dev-env" })),
    );
    expect(status).toBe(200);
    expect(typeof body.cohort1DevEnvConfirmedAt).toBe("number");
  });
});
