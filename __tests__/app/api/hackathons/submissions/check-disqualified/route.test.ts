/**
 * @jest-environment node
 */
import { getAdminDb } from "@/lib/firebase-admin";
import { makeCronRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

const CRON_SECRET = "test-cron-secret-check-dq";

function makeSubmissionDoc(
  id: string,
  data: Record<string, unknown>,
  update = jest.fn().mockResolvedValue(undefined),
) {
  return {
    id,
    data: () => data,
    ref: { update },
  };
}

async function loadGet(cronSecret?: string) {
  jest.resetModules();
  if (cronSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = cronSecret;
  }
  const { GET } = await import(
    "@/app/api/hackathons/submissions/check-disqualified/route"
  );
  const { getAdminDb: getDb } = await import("@/lib/firebase-admin");
  return { GET, getAdminDb: getDb as jest.MockedFunction<typeof getAdminDb> };
}

describe("GET /api/hackathons/submissions/check-disqualified", () => {
  const originalGithub = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GITHUB_TOKEN = "gh-test";
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env.GITHUB_TOKEN = originalGithub;
  });

  it("returns 500 when CRON_SECRET is unset", async () => {
    const { GET } = await loadGet(undefined);
    const { status, body } = await readJson<{ error: string }>(
      await GET(makeCronRequest({ path: "/api/hackathons/submissions/check-disqualified" })),
    );
    expect(status).toBe(500);
    expect(body.error).toMatch(/CRON_SECRET/i);
  });

  it("returns 401 for invalid cron secret", async () => {
    const { GET } = await loadGet(CRON_SECRET);
    const { status } = await readJson(
      await GET(
        makeCronRequest({
          path: "/api/hackathons/submissions/check-disqualified",
          secret: "wrong-secret",
        }),
      ),
    );
    expect(status).toBe(401);
  });

  it("returns 400 for non-virtual hackathon id", async () => {
    const { GET, getAdminDb: getDb } = await loadGet(CRON_SECRET);
    getDb.mockReturnValue({} as never);
    const { status, body } = await readJson<{ error: string }>(
      await GET(
        makeCronRequest({
          path: "/api/hackathons/submissions/check-disqualified",
          secret: CRON_SECRET,
          searchParams: { hackathonId: "hack-a-sprint-2026" },
        }),
      ),
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/virtual hackathons/i);
  });

  it("disqualifies submissions with commits after cutoff", async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const docs = [
      makeSubmissionDoc(
        "sub-1",
        {
          hackathonId: "virtual-2026-05",
          submittedAt: new Date(),
          repoUrl: "https://github.com/acme/project",
          cutoffAt: { toDate: () => new Date("2026-05-01T00:00:00Z") },
        },
        update,
      ),
    ];

    const { GET, getAdminDb: getDb } = await loadGet(CRON_SECRET);
    getDb.mockReturnValue({
      collection: jest.fn(() => ({
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ docs }),
        }),
      })),
    } as never);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ sha: "abc" }],
    });

    const { status, body } = await readJson<{
      hackathonId: string;
      disqualifiedCount: number;
    }>(
      await GET(
        makeCronRequest({
          path: "/api/hackathons/submissions/check-disqualified",
          secret: CRON_SECRET,
          searchParams: { hackathonId: "virtual-2026-05" },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body.disqualifiedCount).toBe(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        disqualified: true,
        disqualifiedReason: "Commit after cutoff",
      }),
    );
  });

  it("skips invalid repo URLs and github errors", async () => {
    const update = jest.fn();
    const docs = [
      makeSubmissionDoc("sub-bad-url", {
        submittedAt: new Date(),
        repoUrl: "not-a-github-url",
        cutoffAt: new Date(),
      }),
      makeSubmissionDoc(
        "sub-github-fail",
        {
          submittedAt: new Date(),
          repoUrl: "https://github.com/acme/fail",
          cutoffAt: new Date(),
        },
        update,
      ),
    ];

    const { GET, getAdminDb: getDb } = await loadGet(CRON_SECRET);
    getDb.mockReturnValue({
      collection: jest.fn(() => ({
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ docs }),
        }),
      })),
    } as never);

    (global.fetch as jest.Mock).mockRejectedValue(new Error("rate limit"));

    const { status, body } = await readJson<{ disqualifiedCount: number }>(
      await GET(
        makeCronRequest({
          path: "/api/hackathons/submissions/check-disqualified",
          secret: CRON_SECRET,
          searchParams: { hackathonId: "virtual-2026-05" },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body.disqualifiedCount).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});
