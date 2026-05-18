/**
 * @jest-environment node
 */
jest.mock("@/lib/github-recent-merged-prs", () => ({
  getGithubRepoPair: () => ({ owner: "acme", repo: "demo" }),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { fetchOpenPrsWithReviewStatusForAuthors } from "@/lib/github-open-pr-review-status";

const originalFetch = global.fetch;

type FetchFn = (url: string) => Promise<Response>;

function mkRes(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

function makePr(overrides: Record<string, unknown> = {}) {
  return {
    number: 1,
    title: "fix",
    html_url: "https://github.com/acme/demo/pull/1",
    draft: false,
    user: { login: "alice" },
    ...overrides,
  };
}

function makeReview(state: string, submittedAt: string | null = "2026-05-01T00:00:00Z") {
  return { state, submitted_at: submittedAt };
}

describe("lib/github-open-pr-review-status", () => {
  beforeEach(() => {
    delete process.env.GITHUB_TOKEN;
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  function setFetch(handler: FetchFn) {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      handler(url),
    );
  }

  it("returns an empty map when the input set is empty (skips all network)", async () => {
    const out = await fetchOpenPrsWithReviewStatusForAuthors(new Set());
    expect(out.size).toBe(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("includes Authorization: Bearer <token> when GITHUB_TOKEN is set", async () => {
    process.env.GITHUB_TOKEN = "ghs_test";
    setFetch((url) => {
      if (url.includes("/pulls/1/reviews")) return Promise.resolve(mkRes([]));
      if (url.includes("/pulls?state=open") || url.includes("&state=open") || url.includes("/pulls?")) {
        return Promise.resolve(mkRes([makePr({ number: 1 })]));
      }
      return Promise.resolve(mkRes([]));
    });
    await fetchOpenPrsWithReviewStatusForAuthors(new Set(["alice"]));
    const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer ghs_test");
  });

  it("returns empty map when first-page list fails (e.g. 401)", async () => {
    setFetch(() => Promise.resolve(mkRes({}, false, 401)));
    const out = await fetchOpenPrsWithReviewStatusForAuthors(new Set(["alice"]));
    expect(out.size).toBe(0);
  });

  it("filters out PRs whose author is not in the requested set", async () => {
    setFetch((url) => {
      if (url.includes("/pulls?")) {
        return Promise.resolve(
          mkRes([
            makePr({ number: 1, user: { login: "alice" } }),
            makePr({ number: 2, user: { login: "carol" } }),
          ]),
        );
      }
      return Promise.resolve(mkRes([]));
    });
    const out = await fetchOpenPrsWithReviewStatusForAuthors(new Set(["alice"]));
    expect(out.has("alice")).toBe(true);
    expect(out.has("carol")).toBe(false);
    expect(out.get("alice")?.[0]?.number).toBe(1);
  });

  it("drops malformed list entries (missing number/title/html_url/user)", async () => {
    setFetch((url) => {
      if (url.includes("/pulls?")) {
        return Promise.resolve(
          mkRes([
            makePr({ number: "not-a-number" as unknown as number }),
            makePr({ title: null }),
            makePr({ html_url: 42 as unknown as string }),
            makePr({ user: null }),
            makePr({ user: { login: 99 } }),
            makePr({ number: 5 }),
          ]),
        );
      }
      return Promise.resolve(mkRes([]));
    });
    const out = await fetchOpenPrsWithReviewStatusForAuthors(new Set(["alice"]));
    expect(out.get("alice")?.map((p) => p.number)).toEqual([5]);
  });

  it("lowercases author login for matching", async () => {
    setFetch((url) => {
      if (url.includes("/pulls?")) {
        return Promise.resolve(
          mkRes([makePr({ user: { login: "AliCe" }, number: 7 })]),
        );
      }
      return Promise.resolve(mkRes([]));
    });
    const out = await fetchOpenPrsWithReviewStatusForAuthors(new Set(["alice"]));
    expect(out.get("alice")?.[0]?.number).toBe(7);
  });

  it("sorts each author's PRs by number descending", async () => {
    setFetch((url) => {
      if (url.includes("/pulls?")) {
        return Promise.resolve(
          mkRes([
            makePr({ number: 11 }),
            makePr({ number: 22 }),
            makePr({ number: 9 }),
          ]),
        );
      }
      return Promise.resolve(mkRes([]));
    });
    const out = await fetchOpenPrsWithReviewStatusForAuthors(new Set(["alice"]));
    expect(out.get("alice")?.map((p) => p.number)).toEqual([22, 11, 9]);
  });

  it("draft PRs get the 'Draft — mark Ready for review…' summary regardless of reviews", async () => {
    setFetch((url) => {
      if (url.includes("/pulls?")) {
        return Promise.resolve(
          mkRes([makePr({ number: 5, draft: true })]),
        );
      }
      return Promise.resolve(mkRes([makeReview("APPROVED")]));
    });
    const out = await fetchOpenPrsWithReviewStatusForAuthors(new Set(["alice"]));
    expect(out.get("alice")?.[0]?.reviewSummary).toMatch(/^Draft —/);
    expect(out.get("alice")?.[0]?.isDraft).toBe(true);
  });

  it("APPROVED wins over earlier COMMENTED (latest-submitted review applies)", async () => {
    setFetch((url) => {
      if (url.includes("/pulls?")) {
        return Promise.resolve(mkRes([makePr({ number: 1 })]));
      }
      return Promise.resolve(
        mkRes([
          makeReview("COMMENTED", "2026-05-01T00:00:00Z"),
          makeReview("APPROVED", "2026-05-02T00:00:00Z"),
        ]),
      );
    });
    const out = await fetchOpenPrsWithReviewStatusForAuthors(new Set(["alice"]));
    expect(out.get("alice")?.[0]?.reviewSummary).toMatch(/^Approved —/);
  });

  it("CHANGES_REQUESTED summary fires when latest review requested changes", async () => {
    setFetch((url) => {
      if (url.includes("/pulls?")) {
        return Promise.resolve(mkRes([makePr({ number: 1 })]));
      }
      return Promise.resolve(mkRes([makeReview("CHANGES_REQUESTED")]));
    });
    const out = await fetchOpenPrsWithReviewStatusForAuthors(new Set(["alice"]));
    expect(out.get("alice")?.[0]?.reviewSummary).toMatch(/^Changes requested —/);
  });

  it("COMMENTED summary fires when only commented review exists", async () => {
    setFetch((url) => {
      if (url.includes("/pulls?")) {
        return Promise.resolve(mkRes([makePr({ number: 1 })]));
      }
      return Promise.resolve(mkRes([makeReview("COMMENTED")]));
    });
    const out = await fetchOpenPrsWithReviewStatusForAuthors(new Set(["alice"]));
    expect(out.get("alice")?.[0]?.reviewSummary).toMatch(/^Review comment/);
  });

  it("DISMISSED is skipped — falls through to next decisive review", async () => {
    setFetch((url) => {
      if (url.includes("/pulls?")) {
        return Promise.resolve(mkRes([makePr({ number: 1 })]));
      }
      return Promise.resolve(
        mkRes([
          makeReview("DISMISSED", "2026-05-03T00:00:00Z"),
          makeReview("APPROVED", "2026-05-02T00:00:00Z"),
        ]),
      );
    });
    const out = await fetchOpenPrsWithReviewStatusForAuthors(new Set(["alice"]));
    expect(out.get("alice")?.[0]?.reviewSummary).toMatch(/^Approved —/);
  });

  it("returns the 'no reviews yet' summary when reviews list is empty", async () => {
    setFetch((url) => {
      if (url.includes("/pulls?")) {
        return Promise.resolve(mkRes([makePr({ number: 1 })]));
      }
      return Promise.resolve(mkRes([]));
    });
    const out = await fetchOpenPrsWithReviewStatusForAuthors(new Set(["alice"]));
    expect(out.get("alice")?.[0]?.reviewSummary).toMatch(/no reviews yet/);
  });

  it("returns the 'check the PR conversation' summary when only undated/unknown-state reviews exist", async () => {
    setFetch((url) => {
      if (url.includes("/pulls?")) {
        return Promise.resolve(mkRes([makePr({ number: 1 })]));
      }
      return Promise.resolve(
        mkRes([
          // submitted_at not a string → filtered out of the dated list,
          // but reviews.length > 0 so we hit the final fallback
          { state: "MUMBLED", submitted_at: null },
        ]),
      );
    });
    const out = await fetchOpenPrsWithReviewStatusForAuthors(new Set(["alice"]));
    expect(out.get("alice")?.[0]?.reviewSummary).toMatch(
      /check the PR conversation/,
    );
  });

  it("returns [] for an unknown review-state in dated reviews (falls through to fallback)", async () => {
    setFetch((url) => {
      if (url.includes("/pulls?")) {
        return Promise.resolve(mkRes([makePr({ number: 1 })]));
      }
      return Promise.resolve(mkRes([makeReview("MUMBLE")]));
    });
    const out = await fetchOpenPrsWithReviewStatusForAuthors(new Set(["alice"]));
    expect(out.get("alice")?.[0]?.reviewSummary).toMatch(
      /check the PR conversation/,
    );
  });

  it("returns empty review list when the reviews fetch fails (e.g. 403)", async () => {
    setFetch((url) => {
      if (url.includes("/pulls?")) {
        return Promise.resolve(mkRes([makePr({ number: 1 })]));
      }
      if (url.includes("/reviews")) return Promise.resolve(mkRes({}, false, 403));
      return Promise.resolve(mkRes([]));
    });
    const out = await fetchOpenPrsWithReviewStatusForAuthors(new Set(["alice"]));
    expect(out.get("alice")?.[0]?.reviewSummary).toMatch(/no reviews yet/);
  });

  it("returns empty review list when the reviews body is not an array", async () => {
    setFetch((url) => {
      if (url.includes("/pulls?")) {
        return Promise.resolve(mkRes([makePr({ number: 1 })]));
      }
      if (url.includes("/reviews"))
        return Promise.resolve(mkRes({ msg: "weird" }));
      return Promise.resolve(mkRes([]));
    });
    const out = await fetchOpenPrsWithReviewStatusForAuthors(new Set(["alice"]));
    expect(out.get("alice")?.[0]?.reviewSummary).toMatch(/no reviews yet/);
  });

  it("paginates open PRs across multiple pages until a short page is returned", async () => {
    const fullPage = (start: number) =>
      Array.from({ length: 100 }, (_, i) =>
        makePr({
          number: start + i,
          html_url: `https://github.com/x/y/pull/${start + i}`,
          user: { login: "alice" },
        }),
      );
    const responses: Record<string, Response> = {};
    setFetch((url) => {
      const u = new URL(url);
      const page = u.searchParams.get("page");
      if (u.pathname.endsWith("/reviews")) return Promise.resolve(mkRes([]));
      if (page === "1") return Promise.resolve(mkRes(fullPage(1)));
      if (page === "2") return Promise.resolve(mkRes(fullPage(101)));
      if (page === "3") return Promise.resolve(mkRes(fullPage(201).slice(0, 50)));
      return Promise.resolve(mkRes([]));
    });
    const out = await fetchOpenPrsWithReviewStatusForAuthors(new Set(["alice"]));
    // 100 + 100 + 50 = 250 PRs
    expect(out.get("alice")?.length).toBe(250);
  });

  it("stops pagination when a page returns 0 items (empty array short-circuit)", async () => {
    setFetch((url) => {
      const u = new URL(url);
      const page = u.searchParams.get("page");
      if (u.pathname.endsWith("/reviews")) return Promise.resolve(mkRes([]));
      if (page === "1")
        return Promise.resolve(mkRes([makePr({ number: 7 })]));
      if (page === "2") return Promise.resolve(mkRes([]));
      return Promise.resolve(mkRes([]));
    });
    const out = await fetchOpenPrsWithReviewStatusForAuthors(new Set(["alice"]));
    expect(out.get("alice")?.length).toBe(1);
  });

  it("returns partial results when a later page fetch fails (page>1 short-circuit)", async () => {
    setFetch((url) => {
      const u = new URL(url);
      const page = u.searchParams.get("page");
      if (u.pathname.endsWith("/reviews")) return Promise.resolve(mkRes([]));
      if (page === "1") {
        return Promise.resolve(
          mkRes(
            Array.from({ length: 100 }, (_, i) =>
              makePr({
                number: i + 1,
                html_url: `https://x/${i + 1}`,
              }),
            ),
          ),
        );
      }
      return Promise.resolve(mkRes({}, false, 500));
    });
    const out = await fetchOpenPrsWithReviewStatusForAuthors(new Set(["alice"]));
    expect(out.get("alice")?.length).toBe(100);
  });
});
