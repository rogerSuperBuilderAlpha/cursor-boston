/**
 * @jest-environment node
 *
 * Coverage push #60 — lib/hackathon-asprint-2026-award-profile-sync.ts.
 * Drives loadHackASprint2026ShowcaseAwardInputs (empty-submissions early
 * exit, full input assembly with AI rank/score + peer averages) and
 * syncHackASprint2026ShowcaseAwardsToUserProfiles (dry-run vs write,
 * missing-user counter, multiple submissions).
 */
const mockFetchShowcase = jest.fn();
jest.mock("@/lib/hackathon-showcase", () => ({
  fetchShowcaseSubmissionsFromGitHub: () => mockFetchShowcase(),
}));

const mockComputeShowcaseAwards = jest.fn();
jest.mock("@/lib/hackathon-asprint-2026-awards", () => ({
  computeShowcaseAwards: (...a: unknown[]) => mockComputeShowcaseAwards(...a),
}));

const mockComputeAiRanks = jest.fn();
jest.mock("@/lib/hackathon-asprint-2026-scores", () => ({
  computeAiRanksBySubmissionId: (...a: unknown[]) => mockComputeAiRanks(...a),
}));

const mockComputePeerAverages = jest.fn();
jest.mock("@/lib/hackathon-asprint-2026-participant-scoring", () => ({
  computePeerAverages: (...a: unknown[]) => mockComputePeerAverages(...a),
}));

const mockGetAllVoterDocs = jest.fn();
const mockResolveVoterGithub = jest.fn();
jest.mock("@/lib/hackathon-asprint-2026-state", () => ({
  getAllHackASprint2026ParticipantScoreDocs: (...a: unknown[]) =>
    mockGetAllVoterDocs(...a),
  hackASprint2026ScoreDocId: (sid: string) => `score-${sid}`,
  resolveVoterGithubByUid: (...a: unknown[]) => mockResolveVoterGithub(...a),
}));

const mockFindUserByGitHubLogin = jest.fn();
jest.mock("@/lib/github", () => ({
  findUserByGitHubLogin: (...a: unknown[]) => mockFindUserByGitHubLogin(...a),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "__serverTimestamp" },
}));

import {
  loadHackASprint2026ShowcaseAwardInputs,
  syncHackASprint2026ShowcaseAwardsToUserProfiles,
} from "@/lib/hackathon-asprint-2026-award-profile-sync";

type Firestore = Parameters<typeof loadHackASprint2026ShowcaseAwardInputs>[0];

function makeDb(scoreDocsBySid: Record<string, { exists: boolean; data?: Record<string, unknown> }>) {
  const userSetCalls: Array<{ uid: string; patch: Record<string, unknown> }> = [];
  const userColl = {
    doc: (uid: string) => ({
      set: jest
        .fn()
        .mockImplementation((patch: Record<string, unknown>) => {
          userSetCalls.push({ uid, patch });
          return Promise.resolve();
        }),
    }),
  };
  const showcaseScores = {
    doc: (id: string) => ({ __id: id }),
  };
  const collection = jest.fn((name: string) => {
    if (name === "users") return userColl;
    if (name === "hackathonShowcaseScores") return showcaseScores;
    throw new Error(`Unknown coll: ${name}`);
  });
  const getAll = jest.fn(async (...refs: Array<{ __id: string }>) =>
    refs.map((r) => {
      const sid = r.__id.replace(/^score-/, "");
      const entry = scoreDocsBySid[sid];
      if (!entry) return { exists: false, data: () => undefined };
      return { exists: entry.exists, data: () => entry.data };
    })
  );
  return { collection, getAll, __userSetCalls: userSetCalls } as unknown as Firestore & {
    __userSetCalls: typeof userSetCalls;
  };
}

beforeEach(() => {
  mockFetchShowcase.mockReset();
  mockComputeShowcaseAwards.mockReset();
  mockComputeAiRanks.mockReset();
  mockComputePeerAverages.mockReset();
  mockGetAllVoterDocs.mockReset();
  mockResolveVoterGithub.mockReset();
  mockFindUserByGitHubLogin.mockReset();
});

describe("loadHackASprint2026ShowcaseAwardInputs", () => {
  it("returns [] short-circuit when there are no submissions", async () => {
    mockFetchShowcase.mockResolvedValueOnce([]);
    const db = makeDb({});
    const out = await loadHackASprint2026ShowcaseAwardInputs(db);
    expect(out).toEqual([]);
    // Should not have touched voter docs or peer averages.
    expect(mockGetAllVoterDocs).not.toHaveBeenCalled();
  });

  it("assembles inputs with aiScore (in range), aiRank, and peer averages", async () => {
    mockFetchShowcase.mockResolvedValueOnce([
      { submissionId: "ProjA", githubLogin: "alice" },
      { submissionId: "ProjB", githubLogin: "bob" },
    ]);
    mockGetAllVoterDocs.mockResolvedValueOnce([{ uid: "v1" }]);
    mockResolveVoterGithub.mockResolvedValueOnce(new Map([["v1", "voter1"]]));
    mockComputePeerAverages.mockReturnValueOnce(
      new Map([
        ["proja", 4.5],
        ["projb", 3.1],
      ])
    );
    mockComputeAiRanks.mockReturnValueOnce(
      new Map([
        ["ProjA", 1],
        ["ProjB", 2],
      ])
    );
    const db = makeDb({
      ProjA: { exists: true, data: { aiScore: 8 } },
      ProjB: { exists: true, data: { aiScore: 11 } }, // out-of-range → null
    });
    const out = await loadHackASprint2026ShowcaseAwardInputs(db);
    expect(out).toEqual([
      {
        submissionId: "ProjA",
        githubLogin: "alice",
        aiRank: 1,
        aiScore: 8,
        peerAverage: 4.5,
      },
      {
        submissionId: "ProjB",
        githubLogin: "bob",
        aiRank: 2,
        aiScore: null,
        peerAverage: 3.1,
      },
    ]);
  });

  it("treats missing score docs and non-numeric aiScore as null", async () => {
    mockFetchShowcase.mockResolvedValueOnce([
      { submissionId: "X", githubLogin: "x" },
      { submissionId: "Y", githubLogin: "y" },
    ]);
    mockGetAllVoterDocs.mockResolvedValueOnce([]);
    mockResolveVoterGithub.mockResolvedValueOnce(new Map());
    mockComputePeerAverages.mockReturnValueOnce(new Map());
    mockComputeAiRanks.mockReturnValueOnce(new Map());
    const db = makeDb({
      X: { exists: false },
      Y: { exists: true, data: { aiScore: "not-a-number" as unknown as number } },
    });
    const out = await loadHackASprint2026ShowcaseAwardInputs(db);
    expect(out[0].aiScore).toBeNull();
    expect(out[1].aiScore).toBeNull();
    expect(out[0].peerAverage).toBeNull();
  });
});

describe("syncHackASprint2026ShowcaseAwardsToUserProfiles", () => {
  it("dry-run skips writes and reports lines + counts", async () => {
    mockFetchShowcase.mockResolvedValueOnce([
      { submissionId: "ProjA", githubLogin: "alice" },
      { submissionId: "ProjB", githubLogin: "ghost" },
    ]);
    mockGetAllVoterDocs.mockResolvedValueOnce([]);
    mockResolveVoterGithub.mockResolvedValueOnce(new Map());
    mockComputePeerAverages.mockReturnValueOnce(new Map());
    mockComputeAiRanks.mockReturnValueOnce(new Map());
    mockComputeShowcaseAwards.mockReturnValueOnce(
      new Map([["proja", ["first-place"]]])
    );
    // alice → uid:u1, ghost → no user
    mockFindUserByGitHubLogin
      .mockResolvedValueOnce("u1")
      .mockResolvedValueOnce(null);

    const db = makeDb({});
    const out = await syncHackASprint2026ShowcaseAwardsToUserProfiles(db, {
      dryRun: true,
    });
    expect(out.written).toBe(1);
    expect(out.missingUser).toBe(1);
    expect(out.lines).toHaveLength(2);
    expect((db as unknown as { __userSetCalls: unknown[] }).__userSetCalls.length).toBe(0);
  });

  it("writes user docs when not in dry-run mode", async () => {
    mockFetchShowcase.mockResolvedValueOnce([
      { submissionId: "ProjA", githubLogin: "alice" },
    ]);
    mockGetAllVoterDocs.mockResolvedValueOnce([]);
    mockResolveVoterGithub.mockResolvedValueOnce(new Map());
    mockComputePeerAverages.mockReturnValueOnce(new Map());
    mockComputeAiRanks.mockReturnValueOnce(new Map());
    mockComputeShowcaseAwards.mockReturnValueOnce(
      new Map([["proja", ["audience-favorite"]]])
    );
    mockFindUserByGitHubLogin.mockResolvedValueOnce("u1");

    const db = makeDb({});
    const out = await syncHackASprint2026ShowcaseAwardsToUserProfiles(db, {
      dryRun: false,
    });
    expect(out.written).toBe(1);
    expect(out.missingUser).toBe(0);
    const calls = (db as unknown as { __userSetCalls: Array<{ uid: string; patch: Record<string, unknown> }> })
      .__userSetCalls;
    expect(calls).toHaveLength(1);
    expect(calls[0].uid).toBe("u1");
    expect(calls[0].patch).toEqual({
      hackASprint2026ShowcaseAwards: ["audience-favorite"],
      updatedAt: "__serverTimestamp",
    });
  });

  it("falls back to [] award kinds when computeShowcaseAwards has no entry for sid", async () => {
    mockFetchShowcase.mockResolvedValueOnce([
      { submissionId: "Solo", githubLogin: "solo" },
    ]);
    mockGetAllVoterDocs.mockResolvedValueOnce([]);
    mockResolveVoterGithub.mockResolvedValueOnce(new Map());
    mockComputePeerAverages.mockReturnValueOnce(new Map());
    mockComputeAiRanks.mockReturnValueOnce(new Map());
    mockComputeShowcaseAwards.mockReturnValueOnce(new Map());
    mockFindUserByGitHubLogin.mockResolvedValueOnce("u1");
    const db = makeDb({});
    const out = await syncHackASprint2026ShowcaseAwardsToUserProfiles(db, {
      dryRun: false,
    });
    expect(out.written).toBe(1);
    const calls = (db as unknown as { __userSetCalls: Array<{ uid: string; patch: Record<string, unknown> }> })
      .__userSetCalls;
    expect(calls[0].patch.hackASprint2026ShowcaseAwards).toEqual([]);
  });

  it("forwards the optional `now` to computeShowcaseAwards", async () => {
    mockFetchShowcase.mockResolvedValueOnce([]);
    mockComputeShowcaseAwards.mockReturnValueOnce(new Map());
    const fixedNow = new Date("2026-05-18T00:00:00.000Z");
    const db = makeDb({});
    await syncHackASprint2026ShowcaseAwardsToUserProfiles(db, {
      dryRun: true,
      now: fixedNow,
    });
    expect(mockComputeShowcaseAwards).toHaveBeenCalledWith([], fixedNow);
  });
});
