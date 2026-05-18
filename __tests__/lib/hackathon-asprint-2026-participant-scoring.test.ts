/**
 * @jest-environment node
 */
import {
  computePeerAverages,
  hackASprint2026ParticipantScoresDocId,
  normalizeParticipantScores,
  participantBallotComplete,
  participantPrizeEligibility,
  type SubmissionIdentity,
} from "@/lib/hackathon-asprint-2026-participant-scoring";
import { HACK_A_SPRINT_2026_EVENT_ID } from "@/lib/hackathon-showcase";

const subs: SubmissionIdentity[] = [
  { submissionId: "Sub-A", githubLogin: "alice" },
  { submissionId: "Sub-B", githubLogin: "bob" },
  { submissionId: "Sub-C", githubLogin: "carol" },
  { submissionId: "Sub-D", githubLogin: "dan" },
  { submissionId: "Sub-E", githubLogin: "erin" },
  { submissionId: "Sub-F", githubLogin: "frank" },
  { submissionId: "Sub-G", githubLogin: "george" },
];

describe("hackathon-asprint-2026-participant-scoring", () => {
  describe("hackASprint2026ParticipantScoresDocId", () => {
    it("composes the event id and userId", () => {
      expect(hackASprint2026ParticipantScoresDocId("u1")).toBe(
        `${HACK_A_SPRINT_2026_EVENT_ID}__u1`
      );
    });
  });

  describe("normalizeParticipantScores", () => {
    it("returns {} for undefined or non-object input", () => {
      expect(normalizeParticipantScores(undefined)).toEqual({});
      expect(normalizeParticipantScores(null as unknown as Record<string, unknown>)).toEqual({});
    });

    it("keeps integers in [1,10] and lowercases keys", () => {
      expect(
        normalizeParticipantScores({ "Sub-A": 7, "Sub-B": 10, "Sub-C": 1 })
      ).toEqual({ "sub-a": 7, "sub-b": 10, "sub-c": 1 });
    });

    it("drops values outside [1,10]", () => {
      expect(normalizeParticipantScores({ a: 0, b: 11, c: -3 })).toEqual({});
    });

    it("drops non-integer values (decimals, NaN, non-numeric)", () => {
      expect(normalizeParticipantScores({ a: 3.5, b: "x", c: NaN, d: null })).toEqual({});
    });

    it("coerces string-formatted integers", () => {
      expect(normalizeParticipantScores({ a: "5", b: "10" })).toEqual({ a: 5, b: 10 });
    });
  });

  describe("participantBallotComplete", () => {
    it("is true when there are no other submissions", () => {
      expect(participantBallotComplete({}, "alice", [subs[0]])).toBe(true);
    });

    it("is false when scores is undefined and others exist", () => {
      expect(participantBallotComplete(undefined, "alice", subs)).toBe(false);
    });

    it("is true when every non-own submission has a valid 1-10 score", () => {
      const scores = {
        "sub-b": 7,
        "sub-c": 9,
        "sub-d": 10,
        "sub-e": 1,
        "sub-f": 5,
        "sub-g": 8,
      };
      expect(participantBallotComplete(scores, "alice", subs)).toBe(true);
    });

    it("is false if any non-own submission is missing a score", () => {
      const scores = { "sub-b": 7, "sub-c": 9 };
      expect(participantBallotComplete(scores, "alice", subs)).toBe(false);
    });

    it("does NOT require a score for the voter's own submission", () => {
      const scores = {
        "sub-b": 7,
        "sub-c": 9,
        "sub-d": 10,
        "sub-e": 1,
        "sub-f": 5,
        "sub-g": 8,
      };
      // alice owns Sub-A; she doesn't score herself, ballot is still complete.
      expect(scores["sub-a"]).toBeUndefined();
      expect(participantBallotComplete(scores, "Alice", subs)).toBe(true);
    });
  });

  describe("participantPrizeEligibility", () => {
    it("requires min(6, #others) high-scores (>8) AND ballot completeness", () => {
      const scores = {
        "sub-b": 9,
        "sub-c": 10,
        "sub-d": 9,
        "sub-e": 9,
        "sub-f": 9,
        "sub-g": 9,
      };
      const r = participantPrizeEligibility(scores, "alice", subs);
      expect(r.requiredHighScores).toBe(6);
      expect(r.highScoreCount).toBe(6);
      expect(r.eligible).toBe(true);
    });

    it("is ineligible when ballot is complete but high-scores are too few", () => {
      const scores = {
        "sub-b": 7,
        "sub-c": 7,
        "sub-d": 9,
        "sub-e": 9,
        "sub-f": 7,
        "sub-g": 7,
      };
      const r = participantPrizeEligibility(scores, "alice", subs);
      expect(r.highScoreCount).toBe(2);
      expect(r.eligible).toBe(false);
    });

    it("is ineligible if scores is undefined", () => {
      const r = participantPrizeEligibility(undefined, "alice", subs);
      expect(r.eligible).toBe(false);
    });

    it("is trivially eligible when there are no other submissions", () => {
      const r = participantPrizeEligibility(undefined, "alice", [subs[0]]);
      expect(r.eligible).toBe(true);
      expect(r.requiredHighScores).toBe(0);
    });

    it("scales requiredHighScores down when #others < 6", () => {
      const trio = subs.slice(0, 3); // alice + bob + carol
      const r = participantPrizeEligibility(
        { "sub-b": 9, "sub-c": 9 },
        "alice",
        trio
      );
      expect(r.requiredHighScores).toBe(2);
      expect(r.eligible).toBe(true);
    });
  });

  describe("computePeerAverages", () => {
    it("returns null for submissions with no peer votes", () => {
      const out = computePeerAverages(subs.slice(0, 2), [], new Map());
      expect(out.get("sub-a")).toBeNull();
      expect(out.get("sub-b")).toBeNull();
    });

    it("computes the mean across voters, excluding self-votes", () => {
      const voters = [
        { userId: "u-bob", scores: { "sub-a": 8, "sub-b": 10 } }, // bob can't vote for himself
        { userId: "u-carol", scores: { "sub-a": 10 } },
      ];
      const voterGh = new Map([
        ["u-bob", "bob"],
        ["u-carol", "carol"],
      ]);
      const out = computePeerAverages(subs.slice(0, 2), voters, voterGh);
      // Sub-A: avg of bob's 8 and carol's 10 = 9
      expect(out.get("sub-a")).toBe(9);
      // Sub-B (bob's): bob's self-vote excluded, carol didn't vote → null
      expect(out.get("sub-b")).toBeNull();
    });

    it("skips voters with no resolved github login", () => {
      const voters = [{ userId: "u-anon", scores: { "sub-a": 7 } }];
      // voter not in the github map → vote ignored
      const out = computePeerAverages(subs.slice(0, 1), voters, new Map());
      expect(out.get("sub-a")).toBeNull();
    });

    it("skips non-numeric score entries", () => {
      const voters = [
        {
          userId: "u-bob",
          scores: { "sub-a": "not-a-number" as unknown as number },
        },
      ];
      const out = computePeerAverages(subs.slice(0, 1), voters, new Map([["u-bob", "bob"]]));
      expect(out.get("sub-a")).toBeNull();
    });
  });
});
