/**
 * @jest-environment node
 */

import {
  computeShowcaseAwards,
  hackASprint2026ZonedWallTimeToUtcMs,
  isHackASprint2026PeerAwardsRevealed,
  showcaseAwardLabelsForRow,
  SHOWCASE_AWARD_LABEL,
  type ShowcaseAwardInput,
  type ShowcaseAwardKind,
} from "@/lib/hackathon-asprint-2026-awards";
import { HACK_A_SPRINT_2026_TIMEZONE } from "@/lib/hackathon-asprint-2026-schedule";

describe("hackASprint2026ZonedWallTimeToUtcMs", () => {
  it("maps April 17, 2026 12:00 NY wall time to the correct UTC instant (EDT)", () => {
    const ms = hackASprint2026ZonedWallTimeToUtcMs(
      HACK_A_SPRINT_2026_TIMEZONE,
      2026,
      4,
      17,
      12,
      0
    );
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: HACK_A_SPRINT_2026_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date(ms));
    const get = (t: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === t)?.value ?? "0");
    expect(get("year")).toBe(2026);
    expect(get("month")).toBe(4);
    expect(get("day")).toBe(17);
    expect(get("hour")).toBe(12);
    expect(get("minute")).toBe(0);
  });
});

describe("computeShowcaseAwards", () => {
  const base: ShowcaseAwardInput[] = [
    {
      submissionId: "michaelrschulte",
      githubLogin: "michaelrschulte",
      aiRank: 1,
      aiScore: 10,
      peerAverage: 9,
    },
    {
      submissionId: "zombiedays",
      githubLogin: "Zombiedays",
      aiRank: 10,
      aiScore: 4,
      peerAverage: 5,
    },
    {
      submissionId: "alice",
      githubLogin: "alice",
      aiRank: 2,
      aiScore: 9,
      peerAverage: 8.5,
    },
    {
      submissionId: "bob",
      githubLogin: "bob",
      aiRank: 3,
      aiScore: 8,
      peerAverage: 9.5,
    },
    {
      submissionId: "carol",
      githubLogin: "carol",
      aiRank: 4,
      aiScore: 7,
      peerAverage: 7,
    },
    {
      submissionId: "dave",
      githubLogin: "dave",
      aiRank: 5,
      aiScore: 6,
      peerAverage: 8.2,
    },
  ];

  it("assigns two judges winners and next two AI ranks, excluding judges from AI slots", () => {
    const beforePeer = new Date("2026-04-17T11:00:00-04:00");
    const m = computeShowcaseAwards(base, beforePeer);
    expect(m.get("michaelrschulte")).toEqual(["judgesWinner"]);
    expect(m.get("zombiedays")).toEqual(["judgesWinner"]);
    expect(m.get("alice")).toEqual(["aiJudgedWinner"]);
    expect(m.get("bob")).toEqual(["aiJudgedWinner"]);
    expect(m.get("carol")).toBeUndefined();
  });

  it("after peer reveal, assigns two peer winners by average excluding prior winners", () => {
    const afterPeer = new Date("2026-04-17T13:00:00-04:00");
    const m = computeShowcaseAwards(base, afterPeer);
    expect(m.get("michaelrschulte")).toEqual(["judgesWinner"]);
    expect(m.get("zombiedays")).toEqual(["judgesWinner"]);
    expect(m.get("alice")).toEqual(["aiJudgedWinner"]);
    expect(m.get("bob")).toEqual(["aiJudgedWinner"]);
    expect(m.get("dave")).toEqual(["peerReviewWinner"]);
    expect(m.get("carol")).toEqual(["peerReviewWinner"]);
  });

  it("isHackASprint2026PeerAwardsRevealed respects time", () => {
    expect(isHackASprint2026PeerAwardsRevealed(new Date("2026-04-17T11:59:00-04:00"))).toBe(
      false
    );
    expect(isHackASprint2026PeerAwardsRevealed(new Date("2026-04-17T12:01:00-04:00"))).toBe(
      true
    );
  });

  it("breaks AI ties by score then by submissionId", () => {
    // Two rows share aiRank=1 — score then submissionId should resolve ordering
    const rows: ShowcaseAwardInput[] = [
      {
        submissionId: "z-row",
        githubLogin: "z-user",
        aiRank: 1,
        aiScore: 5,
        peerAverage: null,
      },
      {
        submissionId: "a-row",
        githubLogin: "a-user",
        aiRank: 1,
        aiScore: 5,
        peerAverage: null,
      },
      {
        submissionId: "b-row",
        githubLogin: "b-user",
        aiRank: 1,
        aiScore: 9, // higher score, wins first AI slot
        peerAverage: null,
      },
    ];
    const m = computeShowcaseAwards(rows, new Date("2026-04-17T11:00:00-04:00"));
    // Top AI score takes the first AI slot
    expect(m.get("b-row")).toEqual(["aiJudgedWinner"]);
    // Then ties resolved by submissionId localeCompare: a-row before z-row
    expect(m.get("a-row")).toEqual(["aiJudgedWinner"]);
    expect(m.get("z-row")).toBeUndefined();
  });

  it("excludes rows with null AI rank AND null AI score from AI awards", () => {
    const rows: ShowcaseAwardInput[] = [
      {
        submissionId: "missing-ai",
        githubLogin: "missing-ai",
        aiRank: null,
        aiScore: null,
        peerAverage: null,
      },
      {
        submissionId: "has-ai",
        githubLogin: "has-ai",
        aiRank: 1,
        aiScore: 9,
        peerAverage: null,
      },
    ];
    const m = computeShowcaseAwards(rows, new Date("2026-04-17T11:00:00-04:00"));
    expect(m.get("has-ai")).toEqual(["aiJudgedWinner"]);
    expect(m.get("missing-ai")).toBeUndefined();
  });

  it("breaks peer ties by submissionId localeCompare", () => {
    const afterPeer = new Date("2026-04-17T13:00:00-04:00");
    const rows: ShowcaseAwardInput[] = [
      {
        submissionId: "z-peer",
        githubLogin: "z-peer",
        aiRank: null,
        aiScore: null,
        peerAverage: 8.0,
      },
      {
        submissionId: "a-peer",
        githubLogin: "a-peer",
        aiRank: null,
        aiScore: null,
        peerAverage: 8.0,
      },
    ];
    const m = computeShowcaseAwards(rows, afterPeer);
    // Ties resolved alphabetically; a-peer wins first slot
    expect(m.get("a-peer")).toEqual(["peerReviewWinner"]);
    expect(m.get("z-peer")).toEqual(["peerReviewWinner"]);
  });

  it("pushes rows with null peerAverage to end of peer ranking", () => {
    const afterPeer = new Date("2026-04-17T13:00:00-04:00");
    const rows: ShowcaseAwardInput[] = [
      {
        submissionId: "no-peer",
        githubLogin: "no-peer",
        aiRank: null,
        aiScore: null,
        peerAverage: null,
      },
      {
        submissionId: "low-peer",
        githubLogin: "low-peer",
        aiRank: null,
        aiScore: null,
        peerAverage: 1.0,
      },
    ];
    const m = computeShowcaseAwards(rows, afterPeer);
    // low-peer wins despite low score; no-peer is excluded by `peerAverage == null` skip
    expect(m.get("low-peer")).toEqual(["peerReviewWinner"]);
    expect(m.get("no-peer")).toBeUndefined();
  });

  it("handles all-null peer averages by alphabetic ordering (still excluded)", () => {
    const afterPeer = new Date("2026-04-17T13:00:00-04:00");
    const rows: ShowcaseAwardInput[] = [
      {
        submissionId: "alpha",
        githubLogin: "alpha",
        aiRank: null,
        aiScore: null,
        peerAverage: null,
      },
      {
        submissionId: "beta",
        githubLogin: "beta",
        aiRank: null,
        aiScore: null,
        peerAverage: null,
      },
    ];
    // No peer winners since peerAverage is null for everyone (continue branch)
    const m = computeShowcaseAwards(rows, afterPeer);
    expect(m.size).toBe(0);
  });
});

describe("env-var override for peer reveal", () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("honours NEXT_PUBLIC_HACK_A_SPRINT_2026_PEER_AWARDS_REVEAL_AT when set", () => {
    process.env.NEXT_PUBLIC_HACK_A_SPRINT_2026_PEER_AWARDS_REVEAL_AT =
      "2026-04-01T00:00:00Z";
    expect(isHackASprint2026PeerAwardsRevealed(new Date("2026-04-02T00:00:00Z"))).toBe(true);
    expect(isHackASprint2026PeerAwardsRevealed(new Date("2026-03-31T23:00:00Z"))).toBe(false);
  });

  it("ignores invalid env-var values and falls back to compiled reveal time", () => {
    process.env.NEXT_PUBLIC_HACK_A_SPRINT_2026_PEER_AWARDS_REVEAL_AT = "not-a-date";
    // Falls back to compiled 2026-04-17 12:00 NY time
    expect(isHackASprint2026PeerAwardsRevealed(new Date("2026-04-17T11:00:00-04:00"))).toBe(
      false,
    );
  });

  it("uses HACK_A_SPRINT_2026_PEER_AWARDS_REVEAL_AT when NEXT_PUBLIC variant absent", () => {
    delete process.env.NEXT_PUBLIC_HACK_A_SPRINT_2026_PEER_AWARDS_REVEAL_AT;
    process.env.HACK_A_SPRINT_2026_PEER_AWARDS_REVEAL_AT = "2026-04-01T00:00:00Z";
    expect(isHackASprint2026PeerAwardsRevealed(new Date("2026-04-02T00:00:00Z"))).toBe(true);
  });
});

describe("showcaseAwardLabelsForRow", () => {
  it("returns empty array when no award for the submission", () => {
    const awards = new Map<string, ShowcaseAwardKind[]>();
    expect(showcaseAwardLabelsForRow(awards, "no-such-id")).toEqual([]);
  });

  it("translates award kinds to display labels", () => {
    const awards = new Map<string, ShowcaseAwardKind[]>([
      ["alice", ["judgesWinner", "peerReviewWinner"]],
    ]);
    expect(showcaseAwardLabelsForRow(awards, "alice")).toEqual([
      SHOWCASE_AWARD_LABEL.judgesWinner,
      SHOWCASE_AWARD_LABEL.peerReviewWinner,
    ]);
  });

  it("normalises submissionId (trim + lowercase) before lookup", () => {
    const awards = new Map<string, ShowcaseAwardKind[]>([
      ["alice", ["aiJudgedWinner"]],
    ]);
    expect(showcaseAwardLabelsForRow(awards, "  ALICE  ")).toEqual([
      SHOWCASE_AWARD_LABEL.aiJudgedWinner,
    ]);
  });
});
