/**
 * @jest-environment node
 *
 * Coverage push #50 — lib/summer-cohort-submissions.ts. Drives the
 * GitHub Contents API → JSON submission walker + user-identity
 * enrichment to 100% statements / functions / lines.
 */

const mockGetAdminDb = jest.fn();
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => mockGetAdminDb(),
}));

jest.mock("@/lib/github-recent-merged-prs", () => ({
  getGithubRepoPair: () => ({ owner: "acme", repo: "demo" }),
}));

jest.mock("@/lib/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import {
  fetchSummerCohortSubmissions,
  getVoteWeekById,
} from "@/lib/summer-cohort-submissions";
import { makeDoc, makeFakeDb, makeQuerySnap } from "@/__tests__/_helpers/firebase-admin-mock";

const originalFetch = global.fetch;

interface VoteWeek {
  submissionBranch: string;
  submissionPath: string;
  liveUrlRequired: boolean;
}

const VOTE_WEEK: VoteWeek = {
  submissionBranch: "c1w1pm-submission",
  submissionPath: "content/summer-cohort/c1/w1-pm/submissions/<github-handle>.json",
  liveUrlRequired: false,
};

beforeEach(() => {
  mockGetAdminDb.mockReset();
  global.fetch = jest.fn();
  delete process.env.GITHUB_TOKEN;
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("getVoteWeekById", () => {
  it("returns null for unknown week ids", () => {
    expect(getVoteWeekById("week-99")).toBeNull();
  });

  it("defaults to cohort-1 when no cohort is supplied", () => {
    const w = getVoteWeekById("week-1");
    expect(w).not.toBeNull();
  });

  it("resolves a known cohort-2 week id", () => {
    const w = getVoteWeekById("week-1", "cohort-2");
    expect(w).not.toBeNull();
  });

  it("returns null for an unknown cohort id", () => {
    expect(
      getVoteWeekById("week-1", "cohort-mystery" as unknown as Parameters<typeof getVoteWeekById>[1]),
    ).toBeNull();
  });
});

function mkRes(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

function mkContentsItem(name: string, downloadUrl?: string) {
  return {
    name,
    path: `content/.../${name}`,
    type: "file",
    download_url: downloadUrl ?? `https://download/${name}`,
  };
}

describe("fetchSummerCohortSubmissions", () => {
  it("returns the empty payload when the contents API 404s (branch not yet created)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mkRes({}, false, 404));
    const out = await fetchSummerCohortSubmissions(VOTE_WEEK, "week-1");
    expect(out.merged).toBe(0);
    expect(out.tryingToWin).toBe(0);
    expect(out.submissions).toEqual([]);
  });

  it("returns the empty payload when the contents API errors (non-2xx, non-404)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mkRes({}, false, 500));
    const out = await fetchSummerCohortSubmissions(VOTE_WEEK, "week-1");
    expect(out.merged).toBe(0);
  });

  it("returns the empty payload when the fetch throws", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network down"));
    const out = await fetchSummerCohortSubmissions(VOTE_WEEK, "week-1");
    expect(out.merged).toBe(0);
  });

  it("returns the empty payload when listJson.json() throws (malformed body)", async () => {
    const malformed = {
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("bad json");
      },
    } as unknown as Response;
    (global.fetch as jest.Mock).mockResolvedValueOnce(malformed);
    const out = await fetchSummerCohortSubmissions(VOTE_WEEK, "week-1");
    expect(out.merged).toBe(0);
  });

  it("returns the empty payload when listJson is not an array", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mkRes({ message: "rate limit" }));
    const out = await fetchSummerCohortSubmissions(VOTE_WEEK, "week-1");
    expect(out.merged).toBe(0);
  });

  it("happy path: walks two submissions, normalizes, sorts, returns counts", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        mkRes([mkContentsItem("bob.json"), mkContentsItem("alice.json"), mkContentsItem("notmd.txt")]),
      )
      .mockImplementation((url: string) => {
        if (url.includes("alice.json")) {
          return Promise.resolve(
            mkRes({
              githubHandle: "alice",
              repoUrl: "https://github.com/x/alice",
              loomUrl: "https://loom/a",
              pitch: "alice pitch",
              competeForWin: true,
            }),
          );
        }
        if (url.includes("bob.json")) {
          return Promise.resolve(
            mkRes({
              githubHandle: "bob",
              repoUrl: "https://github.com/x/bob",
              loomUrl: "https://loom/b",
              pitch: "bob pitch",
              competeForWin: false,
            }),
          );
        }
        return Promise.resolve(mkRes(null, false, 500));
      });
    mockGetAdminDb.mockReturnValueOnce(null); // skip user enrichment
    const out = await fetchSummerCohortSubmissions(VOTE_WEEK, "week-1");
    expect(out.merged).toBe(2);
    // Sorted alphabetically by handle → alice, bob
    expect(out.submissions[0]?.githubHandle).toBe("alice");
    expect(out.submissions[1]?.githubHandle).toBe("bob");
    // alice competes + has all baseline fields → tryingToWin
    expect(out.tryingToWin).toBe(1);
  });

  it("requires liveUrl when week.liveUrlRequired = true", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mkRes([mkContentsItem("alice.json")]))
      .mockResolvedValueOnce(
        mkRes({
          githubHandle: "alice",
          repoUrl: "https://github.com/x/alice",
          loomUrl: "https://loom/a",
          pitch: "alice pitch",
          // no liveUrl
          competeForWin: true,
        }),
      );
    mockGetAdminDb.mockReturnValueOnce(null);
    const out = await fetchSummerCohortSubmissions(
      { ...VOTE_WEEK, liveUrlRequired: true },
      "week-3",
    );
    expect(out.submissions[0]?.allFieldsPresent).toBe(false);
    expect(out.tryingToWin).toBe(0);
  });

  it("falls back to filename when githubHandle is missing from the JSON", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mkRes([mkContentsItem("fallback.json")]))
      .mockResolvedValueOnce(
        mkRes({
          repoUrl: "https://github.com/x",
          loomUrl: "https://loom/a",
          pitch: "p",
        }),
      );
    mockGetAdminDb.mockReturnValueOnce(null);
    const out = await fetchSummerCohortSubmissions(VOTE_WEEK, "week-1");
    expect(out.submissions[0]?.githubHandle).toBe("fallback");
  });

  it("skips items with no download_url", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mkRes([{ name: "x.json", type: "file", download_url: null }]),
    );
    mockGetAdminDb.mockReturnValueOnce(null);
    const out = await fetchSummerCohortSubmissions(VOTE_WEEK, "week-1");
    expect(out.submissions).toEqual([]);
  });

  it("skips items where the per-file download fails (non-OK or throws)", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mkRes([mkContentsItem("a.json"), mkContentsItem("b.json")]))
      .mockImplementation((url: string) => {
        if (url.includes("a.json")) return Promise.resolve(mkRes({}, false, 403));
        if (url.includes("b.json")) return Promise.reject(new Error("net err"));
        return Promise.resolve(mkRes(null, false, 500));
      });
    mockGetAdminDb.mockReturnValueOnce(null);
    const out = await fetchSummerCohortSubmissions(VOTE_WEEK, "week-1");
    expect(out.submissions).toEqual([]);
  });

  it("sends Authorization: Bearer when GITHUB_TOKEN is set", async () => {
    process.env.GITHUB_TOKEN = "gho_test";
    (global.fetch as jest.Mock).mockResolvedValueOnce(mkRes([]));
    mockGetAdminDb.mockReturnValueOnce(null);
    await fetchSummerCohortSubmissions(VOTE_WEEK, "week-1");
    const init = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer gho_test");
  });

  it("enriches submissions with Firebase user identity (displayName + photoURL)", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mkRes([mkContentsItem("alice.json")]))
      .mockResolvedValueOnce(
        mkRes({
          githubHandle: "Alice", // mixed case → lowercased for lookup
          repoUrl: "https://x",
          loomUrl: "https://loom",
          pitch: "p",
        }),
      );

    // Admin DB returns one matching user doc
    const { db } = makeFakeDb({});
    const usersChain = (db.collection("users") as unknown) as Record<string, unknown>;
    // override its .where().get() to return Alice's user doc
    const usersWhereChain = {
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue(
        makeQuerySnap([
          makeDoc("uA", {
            displayName: "Alice Lovelace",
            photoURL: "https://avatar/a.png",
            github: { login: "alice" },
          }),
        ]),
      ),
    };
    usersChain.where = jest.fn().mockReturnValue(usersWhereChain);
    mockGetAdminDb.mockReturnValueOnce(db);

    const out = await fetchSummerCohortSubmissions(VOTE_WEEK, "week-1");
    expect(out.submissions[0]?.displayName).toBe("Alice Lovelace");
    expect(out.submissions[0]?.photoUrl).toBe("https://avatar/a.png");
  });

  it("falls back to JSON-provided name/photoUrl when no Firebase user matches", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mkRes([mkContentsItem("carol.json")]))
      .mockResolvedValueOnce(
        mkRes({
          githubHandle: "carol",
          repoUrl: "https://x",
          loomUrl: "https://loom",
          pitch: "p",
          name: "Carol from JSON",
          photoUrl: "https://json-photo/c.png",
        }),
      );
    // No Firebase users match → empty enrichment
    const { db } = makeFakeDb({});
    const usersChain = (db.collection("users") as unknown) as Record<string, unknown>;
    usersChain.where = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue(makeQuerySnap([])),
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await fetchSummerCohortSubmissions(VOTE_WEEK, "week-1");
    expect(out.submissions[0]?.displayName).toBe("Carol from JSON");
    expect(out.submissions[0]?.photoUrl).toBe("https://json-photo/c.png");
  });

  it("swallows Firestore enrichment errors and still returns submissions", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mkRes([mkContentsItem("dave.json")]))
      .mockResolvedValueOnce(
        mkRes({
          githubHandle: "dave",
          repoUrl: "https://x",
          loomUrl: "https://loom",
          pitch: "p",
        }),
      );
    const { db } = makeFakeDb({});
    const usersChain = (db.collection("users") as unknown) as Record<string, unknown>;
    usersChain.where = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockRejectedValue(new Error("firestore is sad")),
    });
    mockGetAdminDb.mockReturnValueOnce(db);
    const out = await fetchSummerCohortSubmissions(VOTE_WEEK, "week-1");
    expect(out.merged).toBe(1);
    expect(out.submissions[0]?.displayName).toBeNull();
  });
});
