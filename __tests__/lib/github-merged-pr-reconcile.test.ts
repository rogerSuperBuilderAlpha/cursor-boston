/**
 * @jest-environment node
 */

import { reconcileMergedPrCreditForUser } from "@/lib/github-merged-pr-reconcile";
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
});
