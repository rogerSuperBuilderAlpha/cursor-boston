/**
 * @jest-environment node
 */

import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";

describe("getHackASprint2026Phase", () => {
  it("returns preUnlock before 5pm ET on event day", () => {
    expect(getHackASprint2026Phase(new Date("2026-04-13T16:59:00-04:00"))).toBe(
      "preUnlock"
    );
  });

  it("returns passcodeUnlock from 5pm through before 6:30pm ET", () => {
    expect(getHackASprint2026Phase(new Date("2026-04-13T17:00:00-04:00"))).toBe(
      "passcodeUnlock"
    );
    expect(getHackASprint2026Phase(new Date("2026-04-13T18:29:00-04:00"))).toBe(
      "passcodeUnlock"
    );
  });

  it("returns submissionOpen from 6:30pm through before 7:15pm ET", () => {
    expect(getHackASprint2026Phase(new Date("2026-04-13T18:30:00-04:00"))).toBe(
      "submissionOpen"
    );
    expect(getHackASprint2026Phase(new Date("2026-04-13T19:14:00-04:00"))).toBe(
      "submissionOpen"
    );
  });

  it("returns peerVotingOpen from 7:15pm through before 7:45pm ET", () => {
    expect(getHackASprint2026Phase(new Date("2026-04-13T19:15:00-04:00"))).toBe(
      "peerVotingOpen"
    );
    expect(getHackASprint2026Phase(new Date("2026-04-13T19:44:00-04:00"))).toBe(
      "peerVotingOpen"
    );
  });

  it("returns resultsOpen from 7:45pm ET on event day", () => {
    expect(getHackASprint2026Phase(new Date("2026-04-13T19:45:00-04:00"))).toBe(
      "resultsOpen"
    );
  });

  it("returns preUnlock on days before the event", () => {
    expect(getHackASprint2026Phase(new Date("2026-04-12T12:00:00-04:00"))).toBe(
      "preUnlock"
    );
  });

  it("returns resultsOpen on days after the event", () => {
    expect(getHackASprint2026Phase(new Date("2026-04-14T12:00:00-04:00"))).toBe(
      "resultsOpen"
    );
  });
});
