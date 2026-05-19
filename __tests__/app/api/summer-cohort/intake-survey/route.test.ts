/**
 * @jest-environment node
 *
 * Coverage sprint 80 — summer-cohort intake-survey API.
 */
import { GET, POST } from "@/app/api/summer-cohort/intake-survey/route";
import {
  SUMMER_COHORT_INTAKE_COLLECTION,
  intakeSurveyDocId,
} from "@/lib/summer-cohort-intake";
import { SUMMER_COHORT_COLLECTION } from "@/lib/summer-cohort";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/middleware", () => ({
  withMiddleware: (_: unknown, handler: (req: unknown) => unknown) => handler,
  rateLimitConfigs: { standard: {} },
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => ({ __ts: "server" }) },
}));

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), logError: jest.fn() },
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

const user = { uid: "student-1", email: "s@example.com", name: "Student" };

const VALID_INTAKE_BODY = {
  email: "student@example.com",
  cohort: "cohort-1",
  consentToResearch: true,
  age: 25,
  gender: "woman",
  countryOfResidence: "USA",
  countryOfBirth: "USA",
  nativeLanguages: "English",
  englishProficiency: "native",
  highestDegree: "bachelors",
  degreeField: "CS",
  employmentStatus: "yes",
  yearsProgramming: "3-5",
  programmingLanguages: ["Python"],
  priorEngineerEmployment: false,
  csCredential: "undergraduate",
  firstAiYear: 2023,
  llmFrequency: "daily",
  aiToolsUsed: ["cursor"],
  cursorExperience: "daily",
  shippedWithAi: true,
  shippedWithAiDescription: "Built a tool",
  hoursPerWeekAi: 20,
  hoursPerWeekSocial: 5,
  postedAsCreator: false,
  gigPlatformWork: false,
  algorithmUnderstanding: 5,
  baselineEffective: 5,
  baselineUnderstanding: 5,
  whyJoined: "learn",
  eightWeekGoal: "ship",
};

function ts(ms: number) {
  return { toMillis: () => ms };
}

function buildDb(opts: {
  intakeDoc?: { exists: boolean; data?: Record<string, unknown> };
  legacyDoc?: { exists: boolean; data?: Record<string, unknown> };
  appDoc?: { exists: boolean; data?: Record<string, unknown> };
} = {}) {
  const legacyDelete = jest.fn().mockResolvedValue(undefined);
  const intakeGet = jest.fn().mockResolvedValue({
    exists: opts.intakeDoc?.exists ?? false,
    data: () => opts.intakeDoc?.data,
  });
  const legacyGet = jest.fn().mockResolvedValue({
    exists: opts.legacyDoc?.exists ?? false,
    data: () => opts.legacyDoc?.data,
    ref: { delete: legacyDelete },
  });
  const intakeSet = jest.fn().mockResolvedValue(undefined);
  const appGet = jest.fn().mockResolvedValue({
    exists: opts.appDoc?.exists ?? true,
    data: () =>
      opts.appDoc?.data ?? {
        status: "admitted",
        cohorts: ["cohort-1"],
      },
  });

  const collection = jest.fn((name: string) => {
    if (name === SUMMER_COHORT_COLLECTION) {
      return { doc: () => ({ get: appGet }) };
    }
    if (name === SUMMER_COHORT_INTAKE_COLLECTION) {
      return {
        doc: (docId: string) => {
          const isLegacyUidOnly = docId === user.uid;
          return {
            get: isLegacyUidOnly ? legacyGet : intakeGet,
            set: intakeSet,
            ref: isLegacyUidOnly
              ? { delete: legacyDelete }
              : { delete: jest.fn() },
          };
        },
      };
    }
    throw new Error(`unexpected collection ${name}`);
  });

  return { collection, intakeGet, legacyGet, legacyDelete, intakeSet, appGet };
}

describe("GET /api/summer-cohort/intake-survey", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(
      makeRequest({ path: "/api/summer-cohort/intake-survey" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 500 when Firestore admin is unavailable", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    mockGetAdminDb.mockReturnValue(null);
    const res = await GET(
      makeAuthedRequest({ path: "/api/summer-cohort/intake-survey" }),
    );
    expect(res.status).toBe(500);
  });

  it("returns completed false when no survey exists", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    const db = buildDb();
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await GET(
        makeAuthedRequest({
          path: "/api/summer-cohort/intake-survey",
          searchParams: { cohortId: "cohort-2" },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toEqual({ completed: false, response: null });
    expect(db.intakeGet).toHaveBeenCalled();
  });

  it("defaults to cohort-1 and falls back to legacy uid doc", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    const db = buildDb({
      intakeDoc: { exists: false },
      legacyDoc: {
        exists: true,
        data: {
          submittedAt: ts(1_700_000_000_000),
          lastUpdatedAt: ts(1_700_000_100_000),
          email: "legacy@example.com",
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson<{ completed: boolean; response: { uid: string } | null }>(
      await GET(makeAuthedRequest({ path: "/api/summer-cohort/intake-survey" })),
    );

    expect(status).toBe(200);
    expect(body.completed).toBe(true);
    expect(body.response?.uid).toBe(user.uid);
    expect(db.legacyGet).toHaveBeenCalled();
  });

  it("treats a doc without submittedAt as incomplete", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    const db = buildDb({
      intakeDoc: {
        exists: true,
        data: { email: "draft@example.com", lastUpdatedAt: ts(100) },
      },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const { body } = await readJson<{ completed: boolean; response: null }>(
      await GET(
        makeAuthedRequest({
          path: "/api/summer-cohort/intake-survey",
          searchParams: { cohortId: "cohort-1" },
        }),
      ),
    );

    expect(body.completed).toBe(false);
    expect(body.response).toBeNull();
  });

  it("serializes a completed v2 doc", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    const submittedMs = 1_700_000_000_000;
    const db = buildDb({
      intakeDoc: {
        exists: true,
        data: {
          submittedAt: ts(submittedMs),
          email: "done@example.com",
          cohort: "cohort-1",
        },
      },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const { body } = await readJson<{
      completed: boolean;
      response: { submittedAt: number; lastUpdatedAt: number };
    }>(
      await GET(
        makeAuthedRequest({
          path: "/api/summer-cohort/intake-survey",
          searchParams: { cohortId: "cohort-1" },
        }),
      ),
    );

    expect(body.completed).toBe(true);
    expect(body.response.submittedAt).toBe(submittedMs);
    expect(body.response.lastUpdatedAt).toBe(submittedMs);
  });
});

describe("POST /api/summer-cohort/intake-survey", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/summer-cohort/intake-survey",
        body: VALID_INTAKE_BODY,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 500 when Firestore admin is unavailable", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    mockGetAdminDb.mockReturnValue(null);
    const res = await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/summer-cohort/intake-survey",
        body: VALID_INTAKE_BODY,
      }),
    );
    expect(res.status).toBe(500);
  });

  it("returns 400 for invalid JSON", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    mockGetAdminDb.mockReturnValue(buildDb() as never);
    const res = await POST(
      new Request("http://localhost:3000/api/summer-cohort/intake-survey", {
        method: "POST",
        headers: {
          Authorization: "Bearer test-token",
          "content-type": "application/json",
        },
        body: "not-json",
      }) as never,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing cohort", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    mockGetAdminDb.mockReturnValue(buildDb() as never);
    const { status, body } = await readJson<{ error: string }>(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/summer-cohort/intake-survey",
          body: { ...VALID_INTAKE_BODY, cohort: "invalid" },
        }),
      ),
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/cohort/i);
  });

  it("returns 403 when no application exists", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    const db = buildDb({ appDoc: { exists: false } });
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson<{ error: string }>(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/summer-cohort/intake-survey",
          body: VALID_INTAKE_BODY,
        }),
      ),
    );
    expect(status).toBe(403);
    expect(body.error).toMatch(/application/i);
  });

  it("returns 403 when applicant is not admitted", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    const db = buildDb({
      appDoc: { exists: true, data: { status: "pending", cohorts: ["cohort-1"] } },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson<{ error: string }>(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/summer-cohort/intake-survey",
          body: VALID_INTAKE_BODY,
        }),
      ),
    );
    expect(status).toBe(403);
    expect(body.error).toMatch(/admitted/i);
  });

  it("returns 403 when user is not admitted to requested cohort", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    const db = buildDb({
      appDoc: {
        exists: true,
        data: { status: "admitted", cohorts: ["cohort-1"] },
      },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson<{ error: string }>(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/summer-cohort/intake-survey",
          body: { ...VALID_INTAKE_BODY, cohort: "cohort-2" },
        }),
      ),
    );
    expect(status).toBe(403);
    expect(body.error).toMatch(/cohort-2/);
  });

  it("returns 400 when validation fails", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    mockGetAdminDb.mockReturnValue(buildDb() as never);

    const { status, body } = await readJson<{ error: string; missingFields: string[] }>(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/summer-cohort/intake-survey",
          body: { cohort: "cohort-1" },
        }),
      ),
    );
    expect(status).toBe(400);
    expect(body.error).toBe("Validation failed");
    expect(body.missingFields.length).toBeGreaterThan(0);
  });

  it("writes first submission and deletes legacy cohort-1 doc", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    const db = buildDb({
      intakeDoc: { exists: false },
      legacyDoc: { exists: true, data: { submittedAt: ts(1) } },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson<{ ok: boolean; isFirstSubmission: boolean }>(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/summer-cohort/intake-survey",
          body: VALID_INTAKE_BODY,
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.isFirstSubmission).toBe(true);
    expect(db.intakeSet).toHaveBeenCalled();
    expect(db.legacyDelete).toHaveBeenCalled();
    expect(intakeSurveyDocId(user.uid, "cohort-1")).toBe(`${user.uid}_cohort-1`);
  });

  it("updates an existing submission without resubmitting submittedAt", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    const db = buildDb({ intakeDoc: { exists: true, data: { submittedAt: ts(1) } } });
    mockGetAdminDb.mockReturnValue(db as never);

    const { body } = await readJson<{ isFirstSubmission: boolean }>(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/summer-cohort/intake-survey",
          body: VALID_INTAKE_BODY,
        }),
      ),
    );

    expect(body.isFirstSubmission).toBe(false);
    const setPayload = db.intakeSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setPayload.submittedAt).toBeUndefined();
  });

  it("sets participatedInCohort1 on cohort-2 submissions", async () => {
    mockGetVerifiedUser.mockResolvedValue(user);
    const db = buildDb({
      intakeDoc: { exists: false },
      appDoc: {
        exists: true,
        data: { status: "admitted", cohorts: ["cohort-1", "cohort-2"] },
      },
    });
    mockGetAdminDb.mockReturnValue(db as never);

    await POST(
      makeAuthedRequest({
        method: "POST",
        path: "/api/summer-cohort/intake-survey",
        body: { ...VALID_INTAKE_BODY, cohort: "cohort-2" },
      }),
    );

    const setPayload = db.intakeSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setPayload.cohort).toBe("cohort-2");
    expect(setPayload.participatedInCohort1).toBe(true);
  });
});
