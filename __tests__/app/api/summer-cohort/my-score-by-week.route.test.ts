/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #21 — summer-cohort per-user score endpoint.
 *
 * The route resolves the calling user's github handle server-side and fetches
 * their AI-judge score file from the submission branch on github raw. Never
 * accepts a handle query parameter, so the test covers each guard around
 * verification, db, handle resolution, fetch, and parse.
 */
import { GET } from "@/app/api/summer-cohort/my-score/[weekId]/route";
import { getOptionalVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVoteWeekById } from "@/lib/summer-cohort-submissions";
import { getGithubRepoPair } from "@/lib/github-recent-merged-prs";
import { makeRequest } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getOptionalVerifiedUser: jest.fn() }));
jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/summer-cohort-submissions", () => ({
  getVoteWeekById: jest.fn(),
}));
jest.mock("@/lib/github-recent-merged-prs", () => ({
  getGithubRepoPair: jest.fn(() => ({ owner: "rogerSuperBuilderAlpha", repo: "cursor-boston" })),
}));
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

const mockUser = getOptionalVerifiedUser as jest.MockedFunction<typeof getOptionalVerifiedUser>;
const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockVoteWeek = getVoteWeekById as jest.MockedFunction<typeof getVoteWeekById>;
const mockRepoPair = getGithubRepoPair as jest.MockedFunction<typeof getGithubRepoPair>;

function withParams(weekId: string) {
  return { params: Promise.resolve({ weekId }) };
}

function setupUserDoc(login: string | undefined | null) {
  mockDb.mockReturnValue({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          exists: login !== null,
          data: () => (login === undefined ? {} : { github: { login } }),
        }),
      })),
    })),
  } as never);
}

function setupMissingUserDoc() {
  mockDb.mockReturnValue({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
      })),
    })),
  } as never);
}

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_GITHUB_TOKEN = process.env.GITHUB_TOKEN;

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  mockRepoPair.mockReturnValue({ owner: "rogerSuperBuilderAlpha", repo: "cursor-boston" });
  delete process.env.GITHUB_TOKEN;
});
afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_GITHUB_TOKEN !== undefined) process.env.GITHUB_TOKEN = ORIGINAL_GITHUB_TOKEN;
});

describe("GET /api/summer-cohort/my-score/[weekId]", () => {
  it("returns 404 when weekId fails zod validation (empty string)", async () => {
    const res = await GET(makeRequest({ method: "GET" }), withParams(""));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Unknown weekId");
  });

  it("returns 404 when getVoteWeekById returns null", async () => {
    mockVoteWeek.mockReturnValue(null as never);
    const res = await GET(makeRequest({ method: "GET" }), withParams("week-99"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Unknown weekId");
  });

  it("falls back to cohort-1 when cohortId param is invalid", async () => {
    mockVoteWeek.mockReturnValue(null as never);
    await GET(
      makeRequest({ method: "GET", searchParams: { cohortId: "not-a-valid-cohort" } }),
      withParams("week-1"),
    );
    expect(mockVoteWeek).toHaveBeenCalledWith("week-1", "cohort-1");
  });

  it("uses query cohortId when valid", async () => {
    mockVoteWeek.mockReturnValue(null as never);
    await GET(
      makeRequest({ method: "GET", searchParams: { cohortId: "cohort-2" } }),
      withParams("week-1"),
    );
    expect(mockVoteWeek).toHaveBeenCalledWith("week-1", "cohort-2");
  });

  it("returns 401 when verifier throws", async () => {
    mockVoteWeek.mockReturnValue({
      submissionPath: "content/summer-cohort/c1/w1-pm/submissions/x.json",
      submissionBranch: "c1w1pm-submission",
    } as never);
    mockUser.mockRejectedValue(new Error("token bad"));
    const res = await GET(makeRequest({ method: "GET" }), withParams("week-1"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when not signed in", async () => {
    mockVoteWeek.mockReturnValue({
      submissionPath: "content/summer-cohort/c1/w1-pm/submissions/x.json",
      submissionBranch: "c1w1pm-submission",
    } as never);
    mockUser.mockResolvedValue(null);
    const res = await GET(makeRequest({ method: "GET" }), withParams("week-1"));
    expect(res.status).toBe(401);
  });

  it("returns 500 when admin db missing", async () => {
    mockVoteWeek.mockReturnValue({
      submissionPath: "content/summer-cohort/c1/w1-pm/submissions/x.json",
      submissionBranch: "c1w1pm-submission",
    } as never);
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    mockDb.mockReturnValue(null as never);
    const res = await GET(makeRequest({ method: "GET" }), withParams("week-1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Server misconfigured");
  });

  it("returns 404 when the user doc has no github login", async () => {
    mockVoteWeek.mockReturnValue({
      submissionPath: "content/summer-cohort/c1/w1-pm/submissions/x.json",
      submissionBranch: "c1w1pm-submission",
    } as never);
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    setupUserDoc(undefined);
    const res = await GET(makeRequest({ method: "GET" }), withParams("week-1"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Link your GitHub");
  });

  it("returns 404 when user doc does not exist", async () => {
    mockVoteWeek.mockReturnValue({
      submissionPath: "content/summer-cohort/c1/w1-pm/submissions/x.json",
      submissionBranch: "c1w1pm-submission",
    } as never);
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    setupMissingUserDoc();
    const res = await GET(makeRequest({ method: "GET" }), withParams("week-1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when github login is empty/whitespace", async () => {
    mockVoteWeek.mockReturnValue({
      submissionPath: "content/summer-cohort/c1/w1-pm/submissions/x.json",
      submissionBranch: "c1w1pm-submission",
    } as never);
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    setupUserDoc("   ");
    const res = await GET(makeRequest({ method: "GET" }), withParams("week-1"));
    expect(res.status).toBe(404);
  });

  it("returns 500 when submissionPath has no /submissions/ segment", async () => {
    mockVoteWeek.mockReturnValue({
      submissionPath: "content/bogus/path/no-submissions-segment.json",
      submissionBranch: "c1w1pm-submission",
    } as never);
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    setupUserDoc("octocat");
    const res = await GET(makeRequest({ method: "GET" }), withParams("week-1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Misconfigured week");
  });

  it("returns 500 when fetch throws", async () => {
    mockVoteWeek.mockReturnValue({
      submissionPath: "content/summer-cohort/c1/w1-pm/submissions/octocat.json",
      submissionBranch: "c1w1pm-submission",
    } as never);
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    setupUserDoc("octocat");
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network down"));
    const res = await GET(makeRequest({ method: "GET" }), withParams("week-1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Couldn't load");
  });

  it("returns 500 for non-Error throw from fetch", async () => {
    mockVoteWeek.mockReturnValue({
      submissionPath: "content/summer-cohort/c1/w1-pm/submissions/octocat.json",
      submissionBranch: "c1w1pm-submission",
    } as never);
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    setupUserDoc("octocat");
    (global.fetch as jest.Mock).mockRejectedValueOnce("string-failure");
    const res = await GET(makeRequest({ method: "GET" }), withParams("week-1"));
    expect(res.status).toBe(500);
  });

  it("returns 404 when raw fetch status is 404 (no score yet)", async () => {
    mockVoteWeek.mockReturnValue({
      submissionPath: "content/summer-cohort/c1/w1-pm/submissions/octocat.json",
      submissionBranch: "c1w1pm-submission",
    } as never);
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    setupUserDoc("octocat");
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 404,
      ok: false,
      json: () => Promise.resolve({}),
    });
    const res = await GET(makeRequest({ method: "GET" }), withParams("week-1"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("No judge feedback");
  });

  it("returns 500 when raw fetch non-OK with status != 404", async () => {
    mockVoteWeek.mockReturnValue({
      submissionPath: "content/summer-cohort/c1/w1-pm/submissions/octocat.json",
      submissionBranch: "c1w1pm-submission",
    } as never);
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    setupUserDoc("octocat");
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 500,
      ok: false,
      json: () => Promise.resolve({}),
    });
    const res = await GET(makeRequest({ method: "GET" }), withParams("week-1"));
    expect(res.status).toBe(500);
  });

  it("returns 500 when score JSON parse throws", async () => {
    mockVoteWeek.mockReturnValue({
      submissionPath: "content/summer-cohort/c1/w1-pm/submissions/octocat.json",
      submissionBranch: "c1w1pm-submission",
    } as never);
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    setupUserDoc("octocat");
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.reject(new Error("not json")),
    });
    const res = await GET(makeRequest({ method: "GET" }), withParams("week-1"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("malformed");
  });

  it("returns 200 with score payload and private no-store cache header on happy path", async () => {
    mockVoteWeek.mockReturnValue({
      submissionPath: "content/summer-cohort/c1/w1-pm/submissions/octocat.json",
      submissionBranch: "c1w1pm-submission",
    } as never);
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    setupUserDoc("octocat");
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          score: 9,
          rationale: "great PR",
          model: "claude-3",
          scoredAt: "2026-05-10T12:00:00Z",
        }),
    });
    const res = await GET(makeRequest({ method: "GET" }), withParams("week-1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const body = await res.json();
    expect(body).toEqual({
      weekId: "week-1",
      githubHandle: "octocat",
      score: 9,
      rationale: "great PR",
      model: "claude-3",
      scoredAt: "2026-05-10T12:00:00Z",
    });
  });

  it("nulls out missing model/scoredAt fields in the response", async () => {
    mockVoteWeek.mockReturnValue({
      submissionPath: "content/summer-cohort/c1/w1-pm/submissions/octocat.json",
      submissionBranch: "c1w1pm-submission",
    } as never);
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    setupUserDoc("octocat");
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ score: 7, rationale: "ok" }),
    });
    const res = await GET(makeRequest({ method: "GET" }), withParams("week-1"));
    const body = await res.json();
    expect(body.model).toBeNull();
    expect(body.scoredAt).toBeNull();
  });

  it("sends Authorization header when GITHUB_TOKEN is set", async () => {
    process.env.GITHUB_TOKEN = "ghp_secret";
    mockVoteWeek.mockReturnValue({
      submissionPath: "content/summer-cohort/c1/w1-pm/submissions/octocat.json",
      submissionBranch: "c1w1pm-submission",
    } as never);
    mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
    setupUserDoc("octocat");
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ score: 5, rationale: "fine" }),
    });
    await GET(makeRequest({ method: "GET" }), withParams("week-1"));
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer ghp_secret");
  });
});
