/**
 * @jest-environment node
 */
jest.mock("@/lib/logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  fetchRecentMergedPullRequests,
  getGithubRepoPair,
  getGithubRepoWebBaseUrl,
} from "@/lib/github-recent-merged-prs";

const originalFetch = global.fetch;

function mockJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

function pr(overrides: Record<string, unknown> = {}) {
  return {
    number: 1,
    title: "fix: thing",
    html_url: "https://github.com/x/y/pull/1",
    merged_at: "2026-05-01T12:00:00Z",
    user: { login: "alice" },
    ...overrides,
  };
}

describe("lib/github-recent-merged-prs", () => {
  beforeEach(() => {
    delete process.env.GITHUB_REPO_OWNER;
    delete process.env.GITHUB_REPO_NAME;
    delete process.env.GITHUB_TOKEN;
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe("getGithubRepoPair", () => {
    it("returns the default owner/repo when env vars are unset", () => {
      expect(getGithubRepoPair()).toEqual({
        owner: "rogerSuperBuilderAlpha",
        repo: "cursor-boston",
      });
    });

    it("honors GITHUB_REPO_OWNER / GITHUB_REPO_NAME overrides", () => {
      process.env.GITHUB_REPO_OWNER = "acme";
      process.env.GITHUB_REPO_NAME = "demo";
      expect(getGithubRepoPair()).toEqual({ owner: "acme", repo: "demo" });
    });
  });

  describe("getGithubRepoWebBaseUrl", () => {
    it("produces the public https URL for the default repo", () => {
      expect(getGithubRepoWebBaseUrl()).toBe(
        "https://github.com/rogerSuperBuilderAlpha/cursor-boston",
      );
    });

    it("reflects env overrides", () => {
      process.env.GITHUB_REPO_OWNER = "x";
      process.env.GITHUB_REPO_NAME = "y";
      expect(getGithubRepoWebBaseUrl()).toBe("https://github.com/x/y");
    });
  });

  describe("fetchRecentMergedPullRequests", () => {
    it("hits the GitHub pulls API with the expected query params", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockJsonResponse([pr()]),
      );
      await fetchRecentMergedPullRequests();
      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      const u = new URL(url);
      expect(u.host).toBe("api.github.com");
      expect(u.pathname).toBe(
        "/repos/rogerSuperBuilderAlpha/cursor-boston/pulls",
      );
      expect(u.searchParams.get("state")).toBe("closed");
      expect(u.searchParams.get("sort")).toBe("updated");
      expect(u.searchParams.get("direction")).toBe("desc");
      expect(u.searchParams.get("per_page")).toBe("40");
    });

    it("sends GitHub API headers without Authorization when GITHUB_TOKEN is unset", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockJsonResponse([]));
      await fetchRecentMergedPullRequests();
      const init = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
      const headers = init.headers as Record<string, string>;
      expect(headers["Accept"]).toBe("application/vnd.github+json");
      expect(headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
      expect(headers["Authorization"]).toBeUndefined();
    });

    it("adds Authorization: Bearer <token> when GITHUB_TOKEN is set", async () => {
      process.env.GITHUB_TOKEN = "ghs_test";
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockJsonResponse([]));
      await fetchRecentMergedPullRequests();
      const init = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
      const headers = init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer ghs_test");
    });

    it("returns mapped PRs when the upstream call succeeds", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockJsonResponse([
          pr({ number: 10, title: "fix #10", html_url: "https://x/10", merged_at: "2026-04-01T00:00:00Z", user: { login: "alice" } }),
          pr({ number: 11, title: "feat #11", html_url: "https://x/11", merged_at: "2026-04-02T00:00:00Z", user: { login: "bob" } }),
        ]),
      );
      const out = await fetchRecentMergedPullRequests();
      expect(out.error).toBeUndefined();
      expect(out.prs).toEqual([
        {
          number: 10,
          title: "fix #10",
          htmlUrl: "https://x/10",
          mergedAt: "2026-04-01T00:00:00Z",
          authorLogin: "alice",
        },
        {
          number: 11,
          title: "feat #11",
          htmlUrl: "https://x/11",
          mergedAt: "2026-04-02T00:00:00Z",
          authorLogin: "bob",
        },
      ]);
      expect(out.repoUrl).toBe(
        "https://github.com/rogerSuperBuilderAlpha/cursor-boston",
      );
    });

    it("filters out items with no merged_at (closed-but-not-merged PRs)", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockJsonResponse([
          pr({ number: 1, merged_at: null }),
          pr({ number: 2, merged_at: "" }),
          pr({ number: 3 }),
        ]),
      );
      const out = await fetchRecentMergedPullRequests();
      expect(out.prs.map((p) => p.number)).toEqual([3]);
    });

    it("drops items missing number, title, or html_url", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockJsonResponse([
          pr({ number: "not-a-number" as unknown as number }),
          pr({ title: null }),
          pr({ html_url: 42 as unknown as string }),
          pr({ number: 99 }),
        ]),
      );
      const out = await fetchRecentMergedPullRequests();
      expect(out.prs.map((p) => p.number)).toEqual([99]);
    });

    it("falls back authorLogin='unknown' when user.login is absent", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockJsonResponse([
          pr({ number: 5, user: null }),
          pr({ number: 6, user: { login: 42 } }),
        ]),
      );
      const out = await fetchRecentMergedPullRequests();
      expect(out.prs.map((p) => p.authorLogin)).toEqual(["unknown", "unknown"]);
    });

    it("respects the limit parameter (default 8, custom value)", async () => {
      const many = Array.from({ length: 30 }, (_, i) =>
        pr({
          number: i,
          html_url: `https://x/${i}`,
          merged_at: "2026-04-01T00:00:00Z",
        }),
      );
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockJsonResponse(many));
      const out = await fetchRecentMergedPullRequests();
      expect(out.prs).toHaveLength(8);

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockJsonResponse(many));
      const out3 = await fetchRecentMergedPullRequests(3);
      expect(out3.prs).toHaveLength(3);
    });

    it("returns error:true when the upstream response is not ok", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockJsonResponse({}, false, 403),
      );
      const out = await fetchRecentMergedPullRequests();
      expect(out).toEqual({
        prs: [],
        repoUrl: "https://github.com/rogerSuperBuilderAlpha/cursor-boston",
        error: true,
      });
    });

    it("returns error:true when the JSON body is not an array", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockJsonResponse({ message: "rate limited" }),
      );
      const out = await fetchRecentMergedPullRequests();
      expect(out.error).toBe(true);
      expect(out.prs).toEqual([]);
    });

    it("returns error:true and empty prs when fetch throws", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("ECONNRESET"));
      const out = await fetchRecentMergedPullRequests();
      expect(out.error).toBe(true);
      expect(out.prs).toEqual([]);
    });

    it("includes the Next.js revalidate option on the fetch call", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockJsonResponse([]));
      await fetchRecentMergedPullRequests();
      const init = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit & {
        next?: { revalidate: number };
      };
      expect(init.next).toEqual({ revalidate: 300 });
    });
  });
});
