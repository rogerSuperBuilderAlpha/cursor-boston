/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — summer cohort intake aggregates admin route.
 */
import { GET } from "@/app/api/summer-cohort/admin/intake-aggregates/route";
import { SUMMER_COHORT_INTAKE_COLLECTION } from "@/lib/summer-cohort-intake";
import { SUMMER_COHORT_ADMIN_EMAILS_ENV } from "@/lib/summer-cohort-admin-access";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { makeAuthedRequest, makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

const adminUser = {
  uid: "admin1",
  email: "cohort-admin@example.com",
  name: "Cohort Admin",
  isAdmin: true,
};

function buildIntakeDb(rows: Record<string, unknown>[], cohortFilter?: string) {
  const docs = rows.map((data, index) => ({
    id: `intake-${index}`,
    data: () => data,
  }));

  const get = jest.fn().mockResolvedValue({ docs });

  const collection = jest.fn((name: string) => {
    if (name !== SUMMER_COHORT_INTAKE_COLLECTION) {
      throw new Error(`unexpected collection ${name}`);
    }
    if (cohortFilter) {
      return {
        where: jest.fn((field: string, op: string, value: string) => {
          expect(field).toBe("cohort");
          expect(op).toBe("==");
          expect(value).toBe(cohortFilter);
          return { get };
        }),
      };
    }
    return { get };
  });

  return { collection };
}

describe("GET /api/summer-cohort/admin/intake-aggregates", () => {
  const originalAdminEmails = process.env[SUMMER_COHORT_ADMIN_EMAILS_ENV];

  beforeEach(() => {
    jest.clearAllMocks();
    process.env[SUMMER_COHORT_ADMIN_EMAILS_ENV] = "cohort-admin@example.com";
    mockGetVerifiedUser.mockResolvedValue(null);
  });

  afterEach(() => {
    if (originalAdminEmails === undefined) delete process.env[SUMMER_COHORT_ADMIN_EMAILS_ENV];
    else process.env[SUMMER_COHORT_ADMIN_EMAILS_ENV] = originalAdminEmails;
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await GET(
      makeRequest({ path: "/api/summer-cohort/admin/intake-aggregates" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller is not a cohort admin", async () => {
    mockGetVerifiedUser.mockResolvedValue({
      uid: "u1",
      email: "member@example.com",
      name: "Member",
      isAdmin: false,
    });

    const res = await GET(
      makeAuthedRequest({ path: "/api/summer-cohort/admin/intake-aggregates" }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 500 when Firestore admin is unavailable", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);
    mockGetAdminDb.mockReturnValue(null);

    const res = await GET(
      makeAuthedRequest({ path: "/api/summer-cohort/admin/intake-aggregates" }),
    );
    expect(res.status).toBe(500);
  });

  it("returns 400 for an invalid cohort query parameter", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);
    mockGetAdminDb.mockReturnValue(buildIntakeDb([]) as never);

    const res = await GET(
      makeAuthedRequest({
        path: "/api/summer-cohort/admin/intake-aggregates",
        searchParams: { cohort: "" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns aggregate stats across all intake rows", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);
    mockGetAdminDb.mockReturnValue(
      buildIntakeDb([
        {
          cohort: "cohort-1",
          age: 22,
          gender: "woman",
          englishProficiency: "native",
          highestDegree: "bachelors",
          employmentStatus: "student",
          countryOfResidence: "US",
          countryOfBirth: "US",
          yearsProgramming: "1-2",
          programmingLanguages: ["python", "typescript"],
          priorEngineerEmployment: true,
          priorEngineerYears: 1,
          csCredential: "bootcamp",
          firstAiYear: 2023,
          llmFrequency: "daily",
          aiToolsUsed: ["cursor", "chatgpt"],
          cursorExperience: "regular",
          shippedWithAi: true,
          hoursPerWeekAi: 10,
          hoursPerWeekSocial: 3,
          postedAsCreator: false,
          gigPlatformWork: true,
          algorithmUnderstanding: 7,
          baselineEffective: 6,
          baselineUnderstanding: 4,
        },
        {
          cohort: "cohort-2",
          age: null,
          gender: undefined,
          countryOfResidence: "CA",
          programmingLanguages: ["not-a-string", 42],
          priorEngineerEmployment: false,
          shippedWithAi: false,
          postedAsCreator: null,
          algorithmUnderstanding: 3,
          baselineEffective: 2,
        },
      ]) as never,
    );

    const { status, body } = await readJson(
      await GET(makeAuthedRequest({ path: "/api/summer-cohort/admin/intake-aggregates" })),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      total: 2,
      filter: { cohort: null },
      cohortDistribution: { "cohort-1": 1, "cohort-2": 1 },
      demographics: {
        age: { n: 1, mean: 22, min: 22, max: 22 },
        gender: { woman: 1, "(blank)": 1 },
        topCountriesOfResidence: expect.arrayContaining([
          { value: "US", count: 1 },
          { value: "CA", count: 1 },
        ]),
      },
      programming: {
        programmingLanguages: { python: 1, typescript: 1 },
        priorEngineerEmployment: { yes: 1, no: 1, blank: 0 },
      },
      aiTools: {
        shippedWithAi: { yes: 1, no: 1, blank: 0 },
      },
      platforms: {
        postedAsCreator: { yes: 0, no: 1, blank: 1 },
        algorithmUnderstanding: {
          n: 2,
          distribution: expect.objectContaining({ "3": 1, "7": 1 }),
        },
      },
      baselines: {
        baselineEffective: {
          n: 2,
          distribution: expect.objectContaining({ "6": 1, "2": 1 }),
        },
      },
    });
  });

  it("filters aggregates by cohort when requested", async () => {
    mockGetVerifiedUser.mockResolvedValue(adminUser);
    const db = buildIntakeDb([{ cohort: "cohort-1", age: 30 }], "cohort-1");
    mockGetAdminDb.mockReturnValue(db as never);

    const { status, body } = await readJson(
      await GET(
        makeAuthedRequest({
          path: "/api/summer-cohort/admin/intake-aggregates",
          searchParams: { cohort: "cohort-1" },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      total: 1,
      filter: { cohort: "cohort-1" },
      demographics: { age: { n: 1, mean: 30 } },
    });
    expect(db.collection).toHaveBeenCalledWith(SUMMER_COHORT_INTAKE_COLLECTION);
  });
});
