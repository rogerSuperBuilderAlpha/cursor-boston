/**
 * @jest-environment node
 *
 * Coverage push #65 — complementary tests for lib/hackathon-showcase.ts.
 * Existing hackathon-showcase.test.ts only covers 3 paths on
 * githubUserHasMergedLabeledShowcasePr. This file picks up the rest:
 *   - fetchShowcaseSubmissionsFromGitHub (full payload coverage)
 *   - getJudgeUidSet / getJudgeEmailSet env parsing
 *   - githubUserHasRecentlyMergedPr happy/empty/failed/zero-window
 */
jest.mock("@/lib/github-recent-merged-prs", () => ({
  getGithubRepoPair: () => ({ owner: "owner", repo: "repo" }),
}));

// next/cache: defeat the unstable_cache memoization so we can re-run with
// fresh fetch state per test.
jest.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));

// fetchWithTimeout wraps global fetch; route through our jest.fn().
const mockFetch = jest.fn();
jest.mock("@/lib/http-fetch", () => ({
  fetchWithTimeout: (...a: unknown[]) => mockFetch(...a),
}));

import {
  HACK_A_SPRINT_2026_EVENT_ID,
  HACK_A_SPRINT_2026_LABEL,
  HACK_A_SPRINT_2026_SUBMISSIONS_PATH,
  SHOWCASE_SUBMISSIONS_CACHE_TAG,
  fetchShowcaseSubmissionsFromGitHub,
  getJudgeEmailSet,
  getJudgeUidSet,
  githubUserHasRecentlyMergedPr,
} from "@/lib/hackathon-showcase";

function fetchOk<T>(body: T) {
  return { ok: true, status: 200, json: async () => body };
}
function fetchStatus(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const originalToken = process.env.GITHUB_TOKEN;

beforeEach(() => {
  mockFetch.mockReset();
});

afterAll(() => {
  if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = originalToken;
});

describe("module surface", () => {
  it("exports stable string constants", () => {
    expect(HACK_A_SPRINT_2026_EVENT_ID).toBe("hack-a-sprint-2026");
    expect(HACK_A_SPRINT_2026_LABEL).toBe("hack-a-sprint-2026");
    expect(HACK_A_SPRINT_2026_SUBMISSIONS_PATH).toContain("submissions");
    expect(SHOWCASE_SUBMISSIONS_CACHE_TAG).toBe("showcase-submissions");
  });
});

describe("fetchShowcaseSubmissionsFromGitHub", () => {
  it("returns [] on 404 (folder doesn't exist yet)", async () => {
    mockFetch.mockResolvedValueOnce(fetchStatus(404));
    expect(await fetchShowcaseSubmissionsFromGitHub()).toEqual([]);
  });

  it("throws when the contents API fails with a non-404", async () => {
    mockFetch.mockResolvedValueOnce(fetchStatus(500));
    await expect(fetchShowcaseSubmissionsFromGitHub()).rejects.toThrow(
      /GitHub contents API failed: 500/
    );
  });

  it("returns [] when the body isn't an array", async () => {
    mockFetch.mockResolvedValueOnce(fetchOk({ unexpected: true }));
    expect(await fetchShowcaseSubmissionsFromGitHub()).toEqual([]);
  });

  it("filters out non-files, README, example login, bad names", async () => {
    mockFetch.mockResolvedValueOnce(
      fetchOk([
        { name: "alice.json", type: "file", download_url: "a.json" },
        { name: "README.md", type: "file", download_url: "r.md" },
        { name: "example-login.json", type: "file", download_url: "x.json" },
        { name: "no-dot", type: "file", download_url: "n.json" },
        { name: "subdir", type: "dir", download_url: null },
      ])
    );
    mockFetch.mockResolvedValueOnce(
      fetchOk({
        projectRepoUrl: "https://x.com",
        title: "Hi",
        description: "desc",
      })
    );
    const out = await fetchShowcaseSubmissionsFromGitHub();
    expect(out.map((s) => s.githubLogin)).toEqual(["alice"]);
  });

  it("skips entries with missing download_url", async () => {
    mockFetch.mockResolvedValueOnce(
      fetchOk([
        { name: "alice.json", type: "file", download_url: null },
        { name: "bob.json", type: "file", download_url: "b.json" },
      ])
    );
    mockFetch.mockResolvedValueOnce(
      fetchOk({ projectRepoUrl: "u", title: "B", description: "d" })
    );
    const out = await fetchShowcaseSubmissionsFromGitHub();
    expect(out.map((s) => s.githubLogin)).toEqual(["bob"]);
  });

  it("returns [] when the file body is not OK", async () => {
    mockFetch.mockResolvedValueOnce(
      fetchOk([{ name: "alice.json", type: "file", download_url: "a.json" }])
    );
    mockFetch.mockResolvedValueOnce(fetchStatus(500));
    expect(await fetchShowcaseSubmissionsFromGitHub()).toEqual([]);
  });

  it("returns [] when JSON parse throws", async () => {
    mockFetch.mockResolvedValueOnce(
      fetchOk([{ name: "alice.json", type: "file", download_url: "a.json" }])
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("bad json");
      },
    });
    expect(await fetchShowcaseSubmissionsFromGitHub()).toEqual([]);
  });

  it("returns [] when parsed body isn't a plain object", async () => {
    mockFetch.mockResolvedValueOnce(
      fetchOk([{ name: "alice.json", type: "file", download_url: "a.json" }])
    );
    mockFetch.mockResolvedValueOnce(fetchOk(["array", "not", "object"]));
    expect(await fetchShowcaseSubmissionsFromGitHub()).toEqual([]);
  });

  it("title falls back to login when payload.title is empty", async () => {
    mockFetch.mockResolvedValueOnce(
      fetchOk([{ name: "alice.json", type: "file", download_url: "a.json" }])
    );
    mockFetch.mockResolvedValueOnce(
      fetchOk({ projectRepoUrl: "u", title: "", description: "d" })
    );
    const out = await fetchShowcaseSubmissionsFromGitHub();
    expect(out[0].payload.title).toBe("alice");
  });

  it("includes optional fields only when truthy", async () => {
    mockFetch.mockResolvedValueOnce(
      fetchOk([{ name: "alice.json", type: "file", download_url: "a.json" }])
    );
    mockFetch.mockResolvedValueOnce(
      fetchOk({
        projectRepoUrl: " https://r.com ",
        title: "T",
        description: "D",
        deployedUrl: "https://d.com",
        loomVideoUrl: "https://l.com",
        demoVideoUrl: "",
      })
    );
    const out = await fetchShowcaseSubmissionsFromGitHub();
    expect(out[0].payload).toEqual({
      projectRepoUrl: "https://r.com",
      title: "T",
      description: "D",
      deployedUrl: "https://d.com",
      loomVideoUrl: "https://l.com",
    });
  });

  it("sorts results by login (en)", async () => {
    mockFetch.mockResolvedValueOnce(
      fetchOk([
        { name: "charlie.json", type: "file", download_url: "c.json" },
        { name: "alice.json", type: "file", download_url: "a.json" },
        { name: "bob.json", type: "file", download_url: "b.json" },
      ])
    );
    mockFetch.mockResolvedValueOnce(fetchOk({ title: "C" }));
    mockFetch.mockResolvedValueOnce(fetchOk({ title: "A" }));
    mockFetch.mockResolvedValueOnce(fetchOk({ title: "B" }));
    const out = await fetchShowcaseSubmissionsFromGitHub();
    expect(out.map((s) => s.githubLogin)).toEqual(["alice", "bob", "charlie"]);
  });

  it("wraps the inner fetch in try/catch (network error → null)", async () => {
    mockFetch.mockResolvedValueOnce(
      fetchOk([{ name: "alice.json", type: "file", download_url: "a.json" }])
    );
    mockFetch.mockRejectedValueOnce(new Error("network"));
    expect(await fetchShowcaseSubmissionsFromGitHub()).toEqual([]);
  });

  it("attaches Authorization header when GITHUB_TOKEN is set", async () => {
    process.env.GITHUB_TOKEN = "tok";
    mockFetch.mockResolvedValueOnce(fetchOk([]));
    await fetchShowcaseSubmissionsFromGitHub();
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer tok");
    delete process.env.GITHUB_TOKEN;
  });
});

describe("getJudgeUidSet + getJudgeEmailSet", () => {
  it("parses comma-separated uids, trimming + dropping empties", () => {
    process.env.HACK_A_SPRINT_2026_JUDGE_UIDS = "u1, u2 ,, u3";
    expect([...getJudgeUidSet()]).toEqual(["u1", "u2", "u3"]);
  });

  it("returns an empty set when the env is missing", () => {
    delete process.env.HACK_A_SPRINT_2026_JUDGE_UIDS;
    expect(getJudgeUidSet().size).toBe(0);
  });

  it("lowercases judge emails", () => {
    process.env.HACK_A_SPRINT_2026_JUDGE_EMAILS = "Judge@X.com, OTHER@x.com";
    expect([...getJudgeEmailSet()].sort()).toEqual([
      "judge@x.com",
      "other@x.com",
    ]);
  });

  it("returns an empty set when judge-emails env is missing", () => {
    delete process.env.HACK_A_SPRINT_2026_JUDGE_EMAILS;
    expect(getJudgeEmailSet().size).toBe(0);
  });
});

describe("githubUserHasRecentlyMergedPr", () => {
  it("returns false for empty login", async () => {
    expect(await githubUserHasRecentlyMergedPr("", 24)).toBe(false);
  });

  it("returns false for windowHours <= 0", async () => {
    expect(await githubUserHasRecentlyMergedPr("alice", 0)).toBe(false);
    expect(await githubUserHasRecentlyMergedPr("alice", -5)).toBe(false);
  });

  it("returns true when total_count > 0", async () => {
    mockFetch.mockResolvedValueOnce(fetchOk({ total_count: 2 }));
    expect(await githubUserHasRecentlyMergedPr("alice", 24)).toBe(true);
  });

  it("returns false when total_count is 0", async () => {
    mockFetch.mockResolvedValueOnce(fetchOk({ total_count: 0 }));
    expect(await githubUserHasRecentlyMergedPr("alice", 24)).toBe(false);
  });

  it("returns false when API call fails", async () => {
    mockFetch.mockResolvedValueOnce(fetchStatus(404));
    expect(await githubUserHasRecentlyMergedPr("alice", 24)).toBe(false);
  });
});
