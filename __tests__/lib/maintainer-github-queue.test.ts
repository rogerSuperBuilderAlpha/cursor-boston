/**
 * @jest-environment node
 *
 * Coverage push #58 — lib/maintainer-github-queue.ts. Drives:
 *   - hasMaintainerApplicationPullRequest (paged scan, author match,
 *     short-page break, empty-input bail)
 *   - fetchMaintainerReviewQueue (open-to-develop scan, draft skip,
 *     malformed-row skip, approval/commented signals via reviews +
 *     issue comments + review comments)
 */
jest.mock("@/lib/maintainer-application", () => ({
  MAINTAINER_APPLICATION_BRANCH: "maintainer-application",
}));

jest.mock("@/lib/github-recent-merged-prs", () => ({
  getGithubRepoPair: () => ({ owner: "owner", repo: "repo" }),
}));

const loggerSpies = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
jest.mock("@/lib/logger", () => ({
  logger: {
    info: (...a: unknown[]) => loggerSpies.info(...a),
    warn: (...a: unknown[]) => loggerSpies.warn(...a),
    error: (...a: unknown[]) => loggerSpies.error(...a),
    debug: () => {},
  },
}));

import {
  fetchMaintainerReviewQueue,
  hasMaintainerApplicationPullRequest,
} from "@/lib/maintainer-github-queue";

const originalFetch = global.fetch;
const originalToken = process.env.GITHUB_TOKEN;

function fetchOk<T>(payload: T) {
  return { ok: true, status: 200, json: async () => payload };
}
function fetchFail(status: number) {
  return { ok: false, status, json: async () => ({}) };
}

beforeEach(() => {
  loggerSpies.warn.mockClear();
  process.env.GITHUB_TOKEN = "test-token";
});

afterEach(() => {
  global.fetch = originalFetch;
});

afterAll(() => {
  if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = originalToken;
});

describe("hasMaintainerApplicationPullRequest", () => {
  it("returns false for empty/whitespace login without hitting GitHub", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    expect(await hasMaintainerApplicationPullRequest("")).toBe(false);
    expect(await hasMaintainerApplicationPullRequest("   ")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("matches the author case-insensitively across a single page", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        fetchOk([
          { user: { login: "Other" } },
          { user: { login: "TARGET" } },
        ])
      );
    global.fetch = fetchMock as unknown as typeof fetch;
    expect(await hasMaintainerApplicationPullRequest("target")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls through paging when the first 100 contain no match, then short-page break", async () => {
    const fetchMock = jest
      .fn()
      // Page 1: full 100 with no matching author
      .mockResolvedValueOnce(
        fetchOk(
          Array.from({ length: 100 }, (_, i) => ({
            user: { login: `other-${i}` },
          }))
        )
      )
      // Page 2: short batch (no match) → break
      .mockResolvedValueOnce(
        fetchOk([{ user: { login: "stranger" } }])
      );
    global.fetch = fetchMock as unknown as typeof fetch;
    expect(await hasMaintainerApplicationPullRequest("target")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns false when fetch fails (logs a warning)", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(fetchFail(500));
    global.fetch = fetchMock as unknown as typeof fetch;
    expect(await hasMaintainerApplicationPullRequest("target")).toBe(false);
    expect(loggerSpies.warn).toHaveBeenCalled();
  });

  it("ignores rows missing user.login", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      fetchOk([{ user: null }, { user: { login: 42 } }])
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    expect(await hasMaintainerApplicationPullRequest("anyone")).toBe(false);
  });

  it("omits Authorization header when GITHUB_TOKEN isn't set", async () => {
    delete process.env.GITHUB_TOKEN;
    const fetchMock = jest.fn().mockResolvedValueOnce(fetchOk([]));
    global.fetch = fetchMock as unknown as typeof fetch;
    await hasMaintainerApplicationPullRequest("target");
    const args = fetchMock.mock.calls[0];
    const headers = (args[1] as { headers: Record<string, string> }).headers;
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("fetchMaintainerReviewQueue", () => {
  it("returns the empty shape when login is whitespace, with githubConfigured reflecting the token", async () => {
    const out = await fetchMaintainerReviewQueue("   ");
    expect(out.notApproved).toEqual([]);
    expect(out.notCommented).toEqual([]);
    expect(out.approvedNotMerged).toEqual([]);
    expect(out.githubConfigured).toBe(true);
  });

  it("filters out the maintainer's own PRs, drafts, and malformed rows", async () => {
    // Pulls page 1: one draft, one malformed, one authored-by-self, one valid
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        fetchOk([
          {
            number: 100,
            title: "Self PR",
            html_url: "u1",
            user: { login: "ME" },
          },
          {
            number: 101,
            title: "Draft PR",
            html_url: "u2",
            draft: true,
            user: { login: "other" },
          },
          {
            // missing number → skipped
            title: "Bad",
            html_url: "u3",
            user: { login: "other" },
          },
          {
            number: 102,
            title: "Real PR",
            html_url: "u4",
            user: { login: "other" },
          },
        ])
      )
      // Reviews for PR 102 → user APPROVED most recently
      .mockResolvedValueOnce(
        fetchOk([
          {
            user: { login: "ME" },
            state: "APPROVED",
            submitted_at: "2026-05-18T00:00:00Z",
          },
        ])
      )
      // APPROVED with no body doesn't count as commented from the review
      // signal, so fetch issue-comments + review-comments to look for one.
      .mockResolvedValueOnce(fetchOk([]))
      .mockResolvedValueOnce(fetchOk([]));
    global.fetch = fetchMock as unknown as typeof fetch;

    const out = await fetchMaintainerReviewQueue("me");
    expect(out.approvedNotMerged.map((p) => p.number)).toEqual([102]);
    expect(out.notApproved).toEqual([]);
    expect(out.notCommented.map((p) => p.number)).toEqual([102]);
  });

  it("approval-only flows through to notCommented (issue + review comment lookups)", async () => {
    // PR 200 — user APPROVED but never commented. The handler should then
    // hit /issues/200/comments and /pulls/200/comments to look for comments.
    const fetchMock = jest
      .fn()
      // Pulls page 1
      .mockResolvedValueOnce(
        fetchOk([
          { number: 200, title: "T", html_url: "u", user: { login: "other" } },
        ])
      )
      // Reviews
      .mockResolvedValueOnce(
        fetchOk([
          {
            user: { login: "me" },
            state: "APPROVED",
            submitted_at: "2026-05-18T00:00:00Z",
          },
        ])
      )
      // Issue comments — none from me
      .mockResolvedValueOnce(fetchOk([{ user: { login: "stranger" } }]))
      // Review comments — none from me
      .mockResolvedValueOnce(fetchOk([{ user: { login: "stranger" } }]));
    global.fetch = fetchMock as unknown as typeof fetch;

    const out = await fetchMaintainerReviewQueue("me");
    expect(out.approvedNotMerged.map((p) => p.number)).toEqual([200]);
    expect(out.notCommented.map((p) => p.number)).toEqual([200]);
    expect(out.notApproved).toEqual([]);
  });

  it("non-approved + commented via issue comments", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        fetchOk([
          { number: 300, title: "T", html_url: "u", user: { login: "other" } },
        ])
      )
      // Reviews: empty
      .mockResolvedValueOnce(fetchOk([]))
      // Issue comments include me
      .mockResolvedValueOnce(fetchOk([{ user: { login: "ME" } }]));
    global.fetch = fetchMock as unknown as typeof fetch;

    const out = await fetchMaintainerReviewQueue("me");
    expect(out.notApproved.map((p) => p.number)).toEqual([300]);
    expect(out.notCommented).toEqual([]);
    expect(out.approvedNotMerged).toEqual([]);
  });

  it("comment via review (body) signal short-circuits the issue-comments fetch", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        fetchOk([
          { number: 400, title: "T", html_url: "u", user: { login: "other" } },
        ])
      )
      // Review with body → counts as commented via fromReviews
      .mockResolvedValueOnce(
        fetchOk([
          { user: { login: "me" }, state: "DISMISSED", body: "lgtm-ish" },
        ])
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const out = await fetchMaintainerReviewQueue("me");
    expect(out.notApproved.map((p) => p.number)).toEqual([400]);
    expect(out.notCommented).toEqual([]);
    // No issue-comments fetch happened → only 2 fetch calls.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("most-recent review wins when there are multiple from the same user", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        fetchOk([
          { number: 500, title: "T", html_url: "u", user: { login: "other" } },
        ])
      )
      // Two reviews — APPROVED, then REQUEST_CHANGES (newer)
      .mockResolvedValueOnce(
        fetchOk([
          {
            user: { login: "me" },
            state: "APPROVED",
            submitted_at: "2026-05-17T00:00:00Z",
          },
          {
            user: { login: "me" },
            state: "CHANGES_REQUESTED",
            submitted_at: "2026-05-18T00:00:00Z",
          },
        ])
      )
      // CHANGES_REQUESTED w/o body → not a "commented" signal; fall through.
      .mockResolvedValueOnce(fetchOk([]))
      .mockResolvedValueOnce(fetchOk([]));
    global.fetch = fetchMock as unknown as typeof fetch;

    const out = await fetchMaintainerReviewQueue("me");
    // Newest non-pending is CHANGES_REQUESTED → not APPROVED
    expect(out.notApproved.map((p) => p.number)).toEqual([500]);
    expect(out.approvedNotMerged).toEqual([]);
  });

  it("pending reviews are ignored", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        fetchOk([
          { number: 600, title: "T", html_url: "u", user: { login: "other" } },
        ])
      )
      .mockResolvedValueOnce(
        fetchOk([{ user: { login: "me" }, state: "PENDING" }])
      )
      // Issue + review comment fetches (no comments from me)
      .mockResolvedValueOnce(fetchOk([]))
      .mockResolvedValueOnce(fetchOk([]));
    global.fetch = fetchMock as unknown as typeof fetch;
    const out = await fetchMaintainerReviewQueue("me");
    expect(out.notApproved.map((p) => p.number)).toEqual([600]);
    expect(out.notCommented.map((p) => p.number)).toEqual([600]);
  });
});

describe("fetchMaintainerReviewQueue — paging", () => {
  it("breaks on short-page from the pulls scan", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(fetchOk([])); // immediately empty → break
    global.fetch = fetchMock as unknown as typeof fetch;
    const out = await fetchMaintainerReviewQueue("me");
    expect(out.notApproved).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns githubConfigured=false when GITHUB_TOKEN is unset", async () => {
    delete process.env.GITHUB_TOKEN;
    const fetchMock = jest.fn().mockResolvedValueOnce(fetchOk([]));
    global.fetch = fetchMock as unknown as typeof fetch;
    const out = await fetchMaintainerReviewQueue("me");
    expect(out.githubConfigured).toBe(false);
  });
});
