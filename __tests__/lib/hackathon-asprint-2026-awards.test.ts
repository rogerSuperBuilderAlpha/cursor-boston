/**
 * @jest-environment node
 */

import {
  computeShowcaseAwards,
  hackASprint2026ZonedWallTimeToUtcMs,
  isHackASprint2026PeerAwardsRevealed,
  type ShowcaseAwardInput,
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
});
