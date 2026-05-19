/**
 * @jest-environment node
 */

import {
  fetchMergedPullRequestsForAuthor,
  reconcileMergedPrCreditForUser,
} from "@/lib/github-merged-pr-reconcile";
import { getAdminDb } from "@/lib/firebase-admin";

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/github-recent-merged-prs", () => ({
  getGithubRepoPair: jest.fn(() => ({
    owner: "rogerSuperBuilderAlpha",
    repo: "cursor-boston",
  })),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => "serverTimestamp"),
  },
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

describe("reconcileMergedPrCreditForUser", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        items: [
          {
            number: 281,
            title: "Fix event page",
            html_url: "https://github.com/rogerSuperBuilderAlpha/cursor-boston/pull/281",
            created_at: "2026-04-06T20:00:00.000Z",
            updated_at: "2026-04-06T21:00:00.000Z",
            closed_at: "2026-04-06T21:10:00.000Z",
            user: { login: "Shreyas0786" },
          },
        ],
      }),
    })) as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("syncs GitHub PRs and preserves the trusted Firestore count", async () => {
    const batchSet = jest.fn();
    const batchCommit = jest.fn(async () => undefined);
    const userSet = jest.fn(async () => undefined);

    const pullRequestsRef = {
      doc: jest.fn((id: string) => ({ id })),
      where: jest.fn().mockReturnThis(),
      get: jest.fn(async () => ({
        docs: [
          {
            data: () => ({
              repository: "rogerSuperBuilderAlpha/cursor-boston",
            }),
          },
          {
            data: () => ({
              repository: "rogerSuperBuilderAlpha/cursor-boston",
            }),
          },
          {
            data: () => ({
              repository: "other-owner/other-repo",
            }),
          },
        ],
      })),
    };

    const usersRef = {
      doc: jest.fn(() => ({
        set: userSet,
      })),
    };

    const db = {
      batch: jest.fn(() => ({
        set: batchSet,
        commit: batchCommit,
      })),
      collection: jest.fn((name: string) => {
        if (name === "pullRequests") return pullRequestsRef;
        if (name === "users") return usersRef;
        throw new Error(`Unexpected collection: ${name}`);
      }),
    };

    mockGetAdminDb.mockReturnValue(db as never);

    const result = await reconcileMergedPrCreditForUser("user-1", "Shreyas0786");

    expect(result).toEqual({
      mergedPrCount: 2,
      syncedPrCount: 1,
    });
    expect(batchSet).toHaveBeenCalledWith(
      { id: "pr-281" },
      expect.objectContaining({
        prNumber: 281,
        userId: "user-1",
        authorLogin: "Shreyas0786",
        repository: "rogerSuperBuilderAlpha/cursor-boston",
        backfillSource: "github-connect-reconcile",
      }),
      { merge: true }
    );
    expect(userSet).toHaveBeenCalledWith(
      expect.objectContaining({
        pullRequestsCount: 2,
        github: { login: "Shreyas0786" },
      }),
      { merge: true }
    );
  });

  it("throws when admin db is null", async () => {
    mockGetAdminDb.mockReturnValueOnce(null as never);
    await expect(reconcileMergedPrCreditForUser("u1", "alice")).rejects.toThrow(
      "Firebase Admin",
    );
  });

  it("throws when github login is empty / whitespace", async () => {
    mockGetAdminDb.mockReturnValueOnce({} as never);
    await expect(reconcileMergedPrCreditForUser("u1", "   ")).rejects.toThrow(
      "GitHub login is required",
    );
  });

});

describe("fetchMergedPullRequestsForAuthor", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it("returns [] for empty / whitespace login without calling fetch", async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as never;
    expect(await fetchMergedPullRequestsForAuthor("")).toEqual([]);
    expect(await fetchMergedPullRequestsForAuthor("   ")).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws when github search returns non-OK", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 503,
      text: async () => "service unavailable",
    })) as typeof fetch;
    await expect(fetchMergedPullRequestsForAuthor("alice")).rejects.toThrow(
      "GitHub merged PR search failed",
    );
  });

  it("includes Authorization Bearer header when GITHUB_TOKEN is set", async () => {
    process.env.GITHUB_TOKEN = "ghp_secret";
    const fetchSpy = jest.fn(async () => ({
      ok: true,
      json: async () => ({ items: [] }),
    }));
    global.fetch = fetchSpy as never;
    await fetchMergedPullRequestsForAuthor("alice");
    const [, init] = fetchSpy.mock.calls[0];
    expect((init as { headers: Record<string, string> }).headers.Authorization).toBe(
      "Bearer ghp_secret",
    );
  });

  it("breaks pagination when a page returns empty items array", async () => {
    const fetchSpy = jest.fn(async () => ({
      ok: true,
      json: async () => ({ items: [] }),
    }));
    global.fetch = fetchSpy as never;
    const items = await fetchMergedPullRequestsForAuthor("alice");
    expect(items).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("breaks pagination when a page has fewer than SEARCH_PER_PAGE items", async () => {
    let calls = 0;
    const fetchSpy = jest.fn(async () => {
      calls += 1;
      return {
        ok: true,
        json: async () => ({
          items: Array.from({ length: 3 }, (_, i) => ({
            number: i + 1,
            title: `PR ${i + 1}`,
            html_url: `https://example.com/${i + 1}`,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            closed_at: "2026-01-01T00:01:00Z",
            user: { login: "alice" },
          })),
        }),
      };
    });
    global.fetch = fetchSpy as never;
    const items = await fetchMergedPullRequestsForAuthor("alice");
    expect(items).toHaveLength(3);
    expect(calls).toBe(1); // Did not fetch page 2 because page 1 had < 100
  });

  it("handles items=undefined in response (defaults to [])", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })) as typeof fetch;
    expect(await fetchMergedPullRequestsForAuthor("alice")).toEqual([]);
  });
});
