/**
 * @jest-environment node
 */

jest.mock("@/lib/github-recent-merged-prs", () => ({
  getGithubRepoPair: () => ({ owner: "test-owner", repo: "test-repo" }),
}));

jest.mock("@/lib/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import {
  fetchMergedPrCountByAuthorForRepo,
  fetchMergedPrCountsForLogins,
} from "@/lib/github-merged-pr-count";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function okResponse(items: { user?: { login?: string } }[], total = items.length) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ total_count: total, items }),
  };
}

function errorResponse(status: number, retryAfter?: string) {
  return {
    ok: false,
    status,
    headers: { get: (h: string) => (h === "retry-after" ? retryAfter ?? null : null) },
    json: async () => ({}),
  };
}

/* ------------------------------------------------------------------ */
/*  fetchMergedPrCountByAuthorForRepo                                  */
/* ------------------------------------------------------------------ */

describe("fetchMergedPrCountByAuthorForRepo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GITHUB_TOKEN;
  });

  it("aggregates counts by author across pages", async () => {
    // Page 1: full page (100 items) triggers next page fetch
    const page1Items = Array.from({ length: 100 }, (_, i) => ({
      user: { login: i < 60 ? "Alice" : "Bob" },
    }));
    // Page 2: partial page (less than 100) stops pagination
    const page2Items = [
      { user: { login: "Alice" } },
      { user: { login: "charlie" } },
    ];

    mockFetch
      .mockResolvedValueOnce(okResponse(page1Items))
      .mockResolvedValueOnce(okResponse(page2Items));

    const result = await fetchMergedPrCountByAuthorForRepo();

    expect(result).toBeInstanceOf(Map);
    expect(result!.get("alice")).toBe(61);
    expect(result!.get("bob")).toBe(40);
    expect(result!.get("charlie")).toBe(1);
  });

  it("stops when items array is empty", async () => {
    mockFetch.mockResolvedValueOnce(okResponse([]));

    const result = await fetchMergedPrCountByAuthorForRepo();
    expect(result).toBeInstanceOf(Map);
    expect(result!.size).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns null when first page fails", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(500));

    const result = await fetchMergedPrCountByAuthorForRepo();
    expect(result).toBeNull();
  });

  it("returns partial counts when a later page fails", async () => {
    const page1Items = Array.from({ length: 100 }, () => ({
      user: { login: "alice" },
    }));
    mockFetch
      .mockResolvedValueOnce(okResponse(page1Items))
      .mockResolvedValueOnce(errorResponse(500));

    const result = await fetchMergedPrCountByAuthorForRepo();
    expect(result).toBeInstanceOf(Map);
    expect(result!.get("alice")).toBe(100);
  });

  it("retries on 429 rate-limit for first page", async () => {
    mockFetch
      .mockResolvedValueOnce(errorResponse(429, "1"))
      .mockResolvedValueOnce(okResponse([{ user: { login: "alice" } }]));

    const result = await fetchMergedPrCountByAuthorForRepo();
    expect(result!.get("alice")).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));

    const result = await fetchMergedPrCountByAuthorForRepo();
    expect(result).toBeNull();
  });

  it("skips items without a user login", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse([{ user: { login: "alice" } }, { user: null }, {}])
    );

    const result = await fetchMergedPrCountByAuthorForRepo();
    expect(result!.size).toBe(1);
    expect(result!.get("alice")).toBe(1);
  });

  it("includes Authorization header when GITHUB_TOKEN is set", async () => {
    process.env.GITHUB_TOKEN = "ghp_test123";
    mockFetch.mockResolvedValueOnce(okResponse([]));

    await fetchMergedPrCountByAuthorForRepo();

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer ghp_test123");
    delete process.env.GITHUB_TOKEN;
  });
});

/* ------------------------------------------------------------------ */
/*  fetchMergedPrCountsForLogins                                       */
/* ------------------------------------------------------------------ */

describe("fetchMergedPrCountsForLogins", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns counts from preloaded bulk map", async () => {
    const bulk = new Map([
      ["alice", 5],
      ["bob", 3],
    ]);

    const result = await fetchMergedPrCountsForLogins(["Alice", "Bob", "Charlie"], bulk);
    expect(result.get("alice")).toBe(5);
    expect(result.get("bob")).toBe(3);
    expect(result.get("charlie")).toBe(0);
  });

  it("returns empty map for empty logins", async () => {
    const result = await fetchMergedPrCountsForLogins([]);
    expect(result.size).toBe(0);
  });

  it("returns empty map when bulk is null", async () => {
    const result = await fetchMergedPrCountsForLogins(["alice"], null);
    expect(result.size).toBe(0);
  });

  it("deduplicates logins and trims whitespace", async () => {
    const bulk = new Map([["alice", 10]]);
    const result = await fetchMergedPrCountsForLogins(
      ["Alice", " alice ", "ALICE"],
      bulk
    );
    expect(result.size).toBe(1);
    expect(result.get("alice")).toBe(10);
  });

  it("fetches bulk when preloadedBulk is not provided", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse([{ user: { login: "alice" } }])
    );

    const result = await fetchMergedPrCountsForLogins(["alice"]);
    expect(result.get("alice")).toBe(1);
    expect(mockFetch).toHaveBeenCalled();
  });
});
