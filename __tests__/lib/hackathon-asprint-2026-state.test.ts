/**
 * @jest-environment node
 */
import {
  hackASprint2026PeerVoteDocId,
  hackASprint2026ScoreDocId,
  hackASprint2026ParticipantScoresDocId,
} from "@/lib/hackathon-asprint-2026-state";
import { HACK_A_SPRINT_2026_EVENT_ID } from "@/lib/hackathon-showcase";

describe("hackathon-asprint-2026-state pure helpers", () => {
  describe("hackASprint2026PeerVoteDocId", () => {
    it("composes the event id and userId", () => {
      expect(hackASprint2026PeerVoteDocId("u-octocat")).toBe(
        `${HACK_A_SPRINT_2026_EVENT_ID}__u-octocat`
      );
    });

    it("preserves the userId verbatim (no lowercasing)", () => {
      expect(hackASprint2026PeerVoteDocId("U-MixedCase")).toContain("U-MixedCase");
    });
  });

  describe("hackASprint2026ScoreDocId", () => {
    it("composes the event id and lowercased submission id", () => {
      expect(hackASprint2026ScoreDocId("Submission-XYZ")).toBe(
        `${HACK_A_SPRINT_2026_EVENT_ID}__submission-xyz`
      );
    });

    it("is stable across different cases of the same submission id", () => {
      expect(hackASprint2026ScoreDocId("AbCdEf")).toBe(
        hackASprint2026ScoreDocId("abcdef")
      );
    });
  });

  describe("hackASprint2026ParticipantScoresDocId (re-export)", () => {
    it("is a function exposed by the state module", () => {
      expect(typeof hackASprint2026ParticipantScoresDocId).toBe("function");
      // The re-export is the canonical doc-id formatter from
      // lib/hackathon-asprint-2026-participant-scoring — exercising it here
      // pins the re-export, which is itself the contract.
      const id = hackASprint2026ParticipantScoresDocId("u-1");
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });
  });
});
