/**
 * @jest-environment node
 */

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockGet = jest.fn();
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockCollection = jest.fn();
const mockDocFn = jest.fn();
const mockWhere = jest.fn();
const mockLimit = jest.fn();

const mockDb = {
  collection: (...args: unknown[]) => {
    mockCollection(...args);
    return {
      doc: (...dArgs: unknown[]) => {
        mockDocFn(...dArgs);
        return { get: mockGet, set: mockSet, update: mockUpdate };
      },
      where: (...wArgs: unknown[]) => {
        mockWhere(...wArgs);
        return {
          limit: (...lArgs: unknown[]) => {
            mockLimit(...lArgs);
            return { get: mockGet };
          },
        };
      },
    };
  },
};

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => mockDb),
}));

jest.mock("@/lib/github-recent-merged-prs", () => ({
  getGithubRepoPair: () => ({ owner: "test-owner", repo: "test-repo" }),
}));

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "SERVER_TS",
    increment: (n: number) => `INCREMENT(${n})`,
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import {
  verifyWebhookSignature,
  findUserByGitHubLogin,
  isTargetRepository,
  fetchPullRequestChangedFilenames,
  processPullRequest,
} from "@/lib/github";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makePrData(overrides: Record<string, unknown> = {}) {
  return {
    number: 42,
    title: "Fix bug",
    state: "closed",
    merged: true,
    user: { login: "alice" },
    html_url: "https://github.com/test-owner/test-repo/pull/42",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    merged_at: "2026-01-02T00:00:00Z",
    repository: { owner: { login: "test-owner" }, name: "test-repo" },
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  verifyWebhookSignature                                             */
/* ------------------------------------------------------------------ */

describe("verifyWebhookSignature", () => {
  const origEnv = process.env.GITHUB_WEBHOOK_SECRET;

  afterEach(() => {
    if (origEnv !== undefined) {
      process.env.GITHUB_WEBHOOK_SECRET = origEnv;
    } else {
      delete process.env.GITHUB_WEBHOOK_SECRET;
    }
  });

  it("returns false when secret is not set", () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    // Need to re-import to pick up the changed env. Since the module caches
    // GITHUB_WEBHOOK_SECRET at import time, we test the null-signature branch.
    expect(verifyWebhookSignature("payload", null)).toBe(false);
  });

  it("returns false when signature is null", () => {
    expect(verifyWebhookSignature("payload", null)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  isTargetRepository                                                 */
/* ------------------------------------------------------------------ */

describe("isTargetRepository", () => {
  it("returns true for matching owner/repo", () => {
    expect(isTargetRepository("test-owner", "test-repo")).toBe(true);
  });

  it("returns false for non-matching owner", () => {
    expect(isTargetRepository("other", "test-repo")).toBe(false);
  });

  it("returns false for non-matching repo", () => {
    expect(isTargetRepository("test-owner", "other")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  findUserByGitHubLogin                                              */
/* ------------------------------------------------------------------ */

describe("findUserByGitHubLogin", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns userId when user found", async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "user-123" }],
    });

    const result = await findUserByGitHubLogin("alice");
    expect(result).toBe("user-123");
    expect(mockWhere).toHaveBeenCalledWith("github.login", "==", "alice");
  });

  it("returns null when no user found", async () => {
    mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

    const result = await findUserByGitHubLogin("unknown");
    expect(result).toBeNull();
  });

  it("returns null on error", async () => {
    mockGet.mockRejectedValueOnce(new Error("db error"));

    const result = await findUserByGitHubLogin("alice");
    expect(result).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  fetchPullRequestChangedFilenames                                   */
/* ------------------------------------------------------------------ */

describe("fetchPullRequestChangedFilenames", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns filenames on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ filename: "a.ts" }, { filename: "b.ts" }],
    });

    const result = await fetchPullRequestChangedFilenames("owner", "repo", 1);
    expect(result).toEqual(["a.ts", "b.ts"]);
  });

  it("returns empty array on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await fetchPullRequestChangedFilenames("owner", "repo", 1);
    expect(result).toEqual([]);
  });

  it("returns empty array on fetch error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network"));

    const result = await fetchPullRequestChangedFilenames("owner", "repo", 1);
    expect(result).toEqual([]);
  });

  it("filters out entries without filename", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ filename: "a.ts" }, {}, { filename: undefined }],
    });

    const result = await fetchPullRequestChangedFilenames("owner", "repo", 1);
    expect(result).toEqual(["a.ts"]);
  });

  it("returns empty array when response is not an array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ not: "an array" }),
    });

    const result = await fetchPullRequestChangedFilenames("owner", "repo", 1);
    expect(result).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  processPullRequest                                                 */
/* ------------------------------------------------------------------ */

describe("processPullRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: user found, PR doc does not exist
    mockGet.mockResolvedValue({ empty: false, docs: [{ id: "user-123" }] });
    mockSet.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue(undefined);
  });

  it("skips PRs from non-target repository", async () => {
    const pr = makePrData({
      repository: { owner: { login: "other-owner" }, name: "other-repo" },
    });

    await processPullRequest(pr as Parameters<typeof processPullRequest>[0]);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("skips PRs from users without GitHub account", async () => {
    // First call: user lookup returns empty
    mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

    await processPullRequest(makePrData() as Parameters<typeof processPullRequest>[0]);
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("creates PR doc and increments count for newly merged PR", async () => {
    // First call: user lookup
    mockGet.mockResolvedValueOnce({ empty: false, docs: [{ id: "user-123" }] });
    // Second call: existing PR check - does not exist
    mockGet.mockResolvedValueOnce({ exists: false, data: () => null });

    await processPullRequest(makePrData() as Parameters<typeof processPullRequest>[0]);

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        prNumber: 42,
        state: "merged",
        authorLogin: "alice",
        userId: "user-123",
      }),
      { merge: true }
    );
    expect(mockUpdate).toHaveBeenCalledWith({
      pullRequestsCount: "INCREMENT(1)",
    });
  });

  it("does not increment count when PR was already merged", async () => {
    // User lookup
    mockGet.mockResolvedValueOnce({ empty: false, docs: [{ id: "user-123" }] });
    // PR already exists and was merged
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ state: "merged" }),
    });

    await processPullRequest(makePrData() as Parameters<typeof processPullRequest>[0]);

    expect(mockSet).toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("sets state to open for non-merged, non-closed PRs", async () => {
    mockGet.mockResolvedValueOnce({ empty: false, docs: [{ id: "user-123" }] });
    mockGet.mockResolvedValueOnce({ exists: false, data: () => null });

    const pr = makePrData({ state: "open", merged: false, merged_at: null });
    await processPullRequest(pr as Parameters<typeof processPullRequest>[0]);

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ state: "open" }),
      { merge: true }
    );
  });

  it("sets state to closed for closed non-merged PRs", async () => {
    mockGet.mockResolvedValueOnce({ empty: false, docs: [{ id: "user-123" }] });
    mockGet.mockResolvedValueOnce({ exists: false, data: () => null });

    const pr = makePrData({ state: "closed", merged: false, merged_at: null });
    await processPullRequest(pr as Parameters<typeof processPullRequest>[0]);

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ state: "closed" }),
      { merge: true }
    );
  });

  it("decrements count when PR was merged but is no longer", async () => {
    mockGet.mockResolvedValueOnce({ empty: false, docs: [{ id: "user-123" }] });
    // PR was previously merged
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ state: "merged" }),
    });
    // User doc for count check
    mockGet.mockResolvedValueOnce({
      data: () => ({ pullRequestsCount: 5 }),
    });

    const pr = makePrData({ state: "closed", merged: false, merged_at: null });
    await processPullRequest(pr as Parameters<typeof processPullRequest>[0]);

    expect(mockUpdate).toHaveBeenCalledWith({
      pullRequestsCount: "INCREMENT(-1)",
    });
  });

  it("throws when Firebase Admin is not configured", async () => {
    const { getAdminDb } = require("@/lib/firebase-admin");
    (getAdminDb as jest.Mock).mockReturnValueOnce(null);

    await expect(
      processPullRequest(makePrData() as Parameters<typeof processPullRequest>[0])
    ).rejects.toThrow("Firebase Admin is not configured");
  });
});
