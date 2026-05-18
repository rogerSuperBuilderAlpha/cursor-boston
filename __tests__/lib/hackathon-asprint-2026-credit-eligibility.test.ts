/**
 * @jest-environment node
 *
 * Coverage push #49 — lib/hackathon-asprint-2026-credit-eligibility.ts.
 * Drives the resolveHackASprint2026CreditForUser eligibility-gate
 * cascade. Mocks the showcase + signup helpers so the test is purely
 * about which gate fires.
 */

const mockHasMergedPR = jest.fn();
const mockMatchesJudgeException = jest.fn();
const mockSignupDocId = jest.fn((eventId: string, uid: string) => `${eventId}__${uid}`);

jest.mock("@/lib/hackathon-showcase", () => ({
  HACK_A_SPRINT_2026_EVENT_ID: "hack-a-sprint-2026",
  githubUserHasMergedLabeledShowcasePr: (...a: unknown[]) => mockHasMergedPR(...a),
}));

jest.mock("@/lib/hackathon-event-signup", () => ({
  hackathonEventSignupDocId: (eventId: string, uid: string) => mockSignupDocId(eventId, uid),
  profileMatchesHackathonJudgeCheckinException: (...a: unknown[]) =>
    mockMatchesJudgeException(...a),
}));

import { resolveHackASprint2026CreditForUser } from "@/lib/hackathon-asprint-2026-credit-eligibility";
import { makeDoc, makeFakeDb } from "@/__tests__/_helpers/firebase-admin-mock";

beforeEach(() => {
  mockHasMergedPR.mockReset();
  mockMatchesJudgeException.mockReset();
  mockMatchesJudgeException.mockReturnValue(false);
});

function setupDb(opts: {
  signup?: Record<string, unknown> | null;
  user?: Record<string, unknown> | null;
  creditCode?: { creditUrl: string } | null;
  rank?: number;
}) {
  const rank = opts.rank ?? 1;
  const eventId = "hack-a-sprint-2026";
  const { db } = makeFakeDb({
    collections: {
      hackathonEventSignups: {
        byId: opts.signup === undefined
          ? {}
          : opts.signup === null
            ? { [`${eventId}__u1`]: makeDoc(`${eventId}__u1`, undefined) }
            : { [`${eventId}__u1`]: makeDoc(`${eventId}__u1`, opts.signup) },
      },
      users: {
        byId: opts.user === undefined
          ? {}
          : opts.user === null
            ? { u1: makeDoc("u1", undefined) }
            : { u1: makeDoc("u1", opts.user) },
      },
      hackathonCreditCodes: {
        byId:
          opts.creditCode === undefined
            ? {}
            : opts.creditCode === null
              ? { [`${eventId}__${rank}`]: makeDoc(`${eventId}__${rank}`, undefined) }
              : {
                  [`${eventId}__${rank}`]: makeDoc(
                    `${eventId}__${rank}`,
                    opts.creditCode,
                  ),
                },
      },
    },
  });
  return db;
}

describe("resolveHackASprint2026CreditForUser", () => {
  it("returns not_signed_up when the signup doc is missing", async () => {
    const db = setupDb({ signup: null });
    const out = await resolveHackASprint2026CreditForUser(db, "u1");
    expect(out).toEqual({ ok: false, reason: "not_signed_up" });
  });

  it("returns not_checked_in when checkedInAt is missing AND user isn't a judge-exception", async () => {
    mockMatchesJudgeException.mockReturnValueOnce(false);
    const db = setupDb({
      signup: { frozenRank: 1, confirmedAt: new Date() },
      user: { github: { login: "u1" } },
    });
    const out = await resolveHackASprint2026CreditForUser(db, "u1");
    expect(out).toEqual({ ok: false, reason: "not_checked_in" });
  });

  it("bypasses the check-in gate when the user is a judge-exception", async () => {
    mockMatchesJudgeException.mockReturnValueOnce(true);
    mockHasMergedPR.mockResolvedValueOnce(true);
    const db = setupDb({
      signup: { frozenRank: 1, confirmedAt: new Date() },
      user: { github: { login: "judge" } },
      creditCode: { creditUrl: "https://cursor.com/c/123" },
    });
    const out = await resolveHackASprint2026CreditForUser(db, "u1", "judge@cursorboston.com");
    expect(out).toEqual({
      ok: true,
      creditUrl: "https://cursor.com/c/123",
      rank: 1,
    });
  });

  it("returns not_confirmed when frozenRank or confirmedAt is missing", async () => {
    const db = setupDb({
      signup: { checkedInAt: new Date() }, // no frozenRank
      user: { github: { login: "u1" } },
    });
    const out = await resolveHackASprint2026CreditForUser(db, "u1");
    expect(out).toEqual({ ok: false, reason: "not_confirmed" });
  });

  it("returns no_github when github.login is absent on the user", async () => {
    const db = setupDb({
      signup: { checkedInAt: new Date(), frozenRank: 1, confirmedAt: new Date() },
      user: { /* no github field */ },
    });
    const out = await resolveHackASprint2026CreditForUser(db, "u1");
    expect(out).toEqual({ ok: false, reason: "no_github" });
  });

  it("returns no_github when github is set but not an object", async () => {
    const db = setupDb({
      signup: { checkedInAt: new Date(), frozenRank: 1, confirmedAt: new Date() },
      user: { github: "u1-string" },
    });
    const out = await resolveHackASprint2026CreditForUser(db, "u1");
    expect(out).toEqual({ ok: false, reason: "no_github" });
  });

  it("returns not_submitted when the user has no merged labeled PR", async () => {
    mockHasMergedPR.mockResolvedValueOnce(false);
    const db = setupDb({
      signup: { checkedInAt: new Date(), frozenRank: 1, confirmedAt: new Date() },
      user: { github: { login: "u1" } },
    });
    const out = await resolveHackASprint2026CreditForUser(db, "u1");
    expect(out).toEqual({ ok: false, reason: "not_submitted" });
    expect(mockHasMergedPR).toHaveBeenCalledWith("u1");
  });

  it("returns no_code_assigned when the credit-code doc for the user's rank is missing", async () => {
    mockHasMergedPR.mockResolvedValueOnce(true);
    const db = setupDb({
      signup: { checkedInAt: new Date(), frozenRank: 5, confirmedAt: new Date() },
      user: { github: { login: "u1" } },
      creditCode: null,
      rank: 5,
    });
    const out = await resolveHackASprint2026CreditForUser(db, "u1");
    expect(out).toEqual({ ok: false, reason: "no_code_assigned" });
  });

  it("returns the credit URL + rank on the happy path", async () => {
    mockHasMergedPR.mockResolvedValueOnce(true);
    const db = setupDb({
      signup: { checkedInAt: new Date(), frozenRank: 3, confirmedAt: new Date() },
      user: { github: { login: "u1" } },
      creditCode: { creditUrl: "https://cursor.com/c/xyz" },
      rank: 3,
    });
    const out = await resolveHackASprint2026CreditForUser(db, "u1");
    expect(out).toEqual({
      ok: true,
      creditUrl: "https://cursor.com/c/xyz",
      rank: 3,
    });
  });
});
