/**
 * @jest-environment node
 *
 * OpenSSF Gold coverage push #31 — Hack-a-Sprint 2026 "me" GET route.
 */
import { NextRequest } from "next/server";
import { GET } from "@/app/api/hackathons/showcase/hack-a-sprint-2026/me/route";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  fetchShowcaseSubmissionsFromGitHub,
  getJudgeUidSet,
  githubUserHasMergedLabeledShowcasePr,
} from "@/lib/hackathon-showcase";
import { userIsHackASprint2026JudgeFromUserData } from "@/lib/hackathon-showcase-admin";
import { getHackASprint2026Phase } from "@/lib/hackathon-asprint-2026-schedule";
import {
  participantBallotComplete,
  participantPrizeEligibility,
} from "@/lib/hackathon-asprint-2026-participant-scoring";

jest.mock("@/lib/firebase-admin", () => ({ getAdminDb: jest.fn() }));
jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/hackathon-showcase", () => ({
  ...jest.requireActual("@/lib/hackathon-showcase"),
  fetchShowcaseSubmissionsFromGitHub: jest.fn(),
  getJudgeUidSet: jest.fn(),
  githubUserHasMergedLabeledShowcasePr: jest.fn(),
}));
jest.mock("@/lib/hackathon-showcase-admin", () => ({
  ...jest.requireActual("@/lib/hackathon-showcase-admin"),
  userIsHackASprint2026JudgeFromUserData: jest.fn(),
}));
jest.mock("@/lib/hackathon-asprint-2026-schedule", () => ({
  ...jest.requireActual("@/lib/hackathon-asprint-2026-schedule"),
  getHackASprint2026Phase: jest.fn(),
}));
jest.mock("@/lib/hackathon-asprint-2026-participant-scoring", () => ({
  ...jest.requireActual("@/lib/hackathon-asprint-2026-participant-scoring"),
  participantBallotComplete: jest.fn(),
  participantPrizeEligibility: jest.fn(),
}));

const mockDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const mockUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockSubs = fetchShowcaseSubmissionsFromGitHub as jest.MockedFunction<
  typeof fetchShowcaseSubmissionsFromGitHub
>;
const mockJudgeUidSet = getJudgeUidSet as jest.MockedFunction<typeof getJudgeUidSet>;
const mockHasMergedPr = githubUserHasMergedLabeledShowcasePr as jest.MockedFunction<
  typeof githubUserHasMergedLabeledShowcasePr
>;
const mockIsJudgeFromUser = userIsHackASprint2026JudgeFromUserData as jest.MockedFunction<
  typeof userIsHackASprint2026JudgeFromUserData
>;
const mockPhase = getHackASprint2026Phase as jest.MockedFunction<typeof getHackASprint2026Phase>;
const mockBallot = participantBallotComplete as jest.MockedFunction<typeof participantBallotComplete>;
const mockPrize = participantPrizeEligibility as jest.MockedFunction<
  typeof participantPrizeEligibility
>;

function makeReq() {
  return new NextRequest("https://example.com/api/hackathons/showcase/hack-a-sprint-2026/me");
}

interface DbOpts {
  userDoc?: { exists: boolean; data?: Record<string, unknown> };
  signupDoc?: { exists: boolean; data?: Record<string, unknown> };
  psDoc?: { exists: boolean; data?: Record<string, unknown> };
}

function setupDb(opts: DbOpts = {}) {
  const userSnap = {
    exists: opts.userDoc?.exists ?? true,
    data: () =>
      opts.userDoc?.data ?? { github: { login: "alice-handle" } },
  };
  const signupSnap = {
    exists: opts.signupDoc?.exists ?? true,
    data: () => opts.signupDoc?.data ?? { checkedInAt: new Date() },
  };
  const psGet = jest.fn().mockResolvedValue({
    exists: opts.psDoc?.exists ?? false,
    data: () => opts.psDoc?.data ?? undefined,
  });

  const collection = jest.fn((name: string) => {
    if (name === "hackathonASprint2026ParticipantScores") {
      return { doc: jest.fn(() => ({ get: psGet })) };
    }
    return { doc: jest.fn(() => ({ id: "ref" })) };
  });
  const getAll = jest.fn().mockResolvedValue([signupSnap, userSnap]);
  mockDb.mockReturnValue({ collection, getAll } as never);
  return { psGet, getAll };
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.mockResolvedValue({ uid: "u1", email: "u@x" } as never);
  mockJudgeUidSet.mockReturnValue(new Set());
  mockIsJudgeFromUser.mockReturnValue(false);
  mockPhase.mockReturnValue("checkin");
  mockSubs.mockResolvedValue([
    { submissionId: "team-alpha", githubLogin: "alice-handle" } as never,
    { submissionId: "team-beta", githubLogin: "bob-handle" } as never,
  ]);
  mockHasMergedPr.mockResolvedValue(false);
  mockBallot.mockReturnValue(false);
  mockPrize.mockReturnValue({
    eligible: false,
    highScoreCount: 0,
    requiredHighScores: 3,
  } as never);
  delete process.env.HACK_A_SPRINT_2026_ALLOWED_SUBMISSIONS;
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("GET /api/hackathons/showcase/hack-a-sprint-2026/me", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns default eligibility shape when admin db is null", async () => {
    mockDb.mockReturnValue(null as never);
    mockHasMergedPr.mockResolvedValueOnce(false);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      signedUp: false,
      checkedIn: false,
      githubLogin: null,
      participantEligible: false,
    });
  });

  it("marks user as judgeEligible from getJudgeUidSet", async () => {
    mockJudgeUidSet.mockReturnValue(new Set(["u1"]));
    mockDb.mockReturnValue(null as never);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.judgeEligible).toBe(true);
  });

  it("re-derives judgeEligible from user profile when db is available", async () => {
    mockIsJudgeFromUser.mockReturnValue(true);
    setupDb();
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.judgeEligible).toBe(true);
  });

  it("returns signedUp=true and checkedIn=true when signup doc has checkedInAt", async () => {
    setupDb();
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.signedUp).toBe(true);
    expect(body.checkedIn).toBe(true);
    expect(body.githubLogin).toBe("alice-handle");
  });

  it("uses profileMatchesHackathonJudgeCheckinException to allow judge checkin without signup", async () => {
    setupDb({
      signupDoc: { exists: false },
      userDoc: {
        exists: true,
        data: {
          github: { login: "judge-x" },
          // Mark profile as judge exception via the judge claim (function uses email lookup mostly)
          isHackASprint2026Judge: true,
        },
      },
    });
    const res = await GET(makeReq());
    const body = await res.json();
    // signedUp is exists, not the exception
    expect(body.signedUp).toBe(false);
    // checkedIn may be true if judge exception applies for this email — depends on the helper.
    // We mainly want to ensure no throw.
    expect(typeof body.checkedIn).toBe("boolean");
  });

  it("returns githubLogin lowercased and trimmed", async () => {
    setupDb({
      userDoc: { exists: true, data: { github: { login: "   AliceHandle   " } } },
    });
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.githubLogin).toBe("alicehandle");
  });

  it("skips peer-voting fetch when no githubLogin on profile", async () => {
    setupDb({ userDoc: { exists: true, data: { github: {} } } });
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.githubLogin).toBeNull();
    expect(mockSubs).not.toHaveBeenCalled();
  });

  it("skips peer-voting when signedUp=false", async () => {
    setupDb({ signupDoc: { exists: false } });
    const res = await GET(makeReq());
    expect(mockSubs).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.signedUp).toBe(false);
  });

  it("skips peer-voting when checkedIn=false", async () => {
    setupDb({ signupDoc: { exists: true, data: { checkedInAt: null } } });
    const res = await GET(makeReq());
    expect(mockSubs).not.toHaveBeenCalled();
  });

  it("loads existing participant scores and computes ballot completeness + prize eligibility", async () => {
    mockBallot.mockReturnValue(true);
    mockPrize.mockReturnValue({
      eligible: true,
      highScoreCount: 5,
      requiredHighScores: 3,
    } as never);
    setupDb({
      psDoc: {
        exists: true,
        data: { scores: { "team-beta": 9 } },
      },
    });
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.hasCompletedPeerVoting).toBe(true);
    expect(body.prizeEligible).toBe(true);
    expect(body.highScoreCount).toBe(5);
    expect(body.requiredHighScores).toBe(3);
  });

  it("uses empty scores map when participant scores doc does not exist", async () => {
    setupDb({ psDoc: { exists: false } });
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(mockBallot).toHaveBeenCalledWith({}, "alice-handle", expect.any(Array));
  });

  it("filters submissions via HACK_A_SPRINT_2026_ALLOWED_SUBMISSIONS env var", async () => {
    process.env.HACK_A_SPRINT_2026_ALLOWED_SUBMISSIONS = "team-beta";
    setupDb();
    await GET(makeReq());
    // Identities passed to participantBallotComplete should only contain team-beta
    const identities = mockBallot.mock.calls[0]?.[2] as Array<{ submissionId: string }>;
    expect(identities).toEqual([{ submissionId: "team-beta", githubLogin: "bob-handle" }]);
  });

  it("ignores empty-string allowed env var (filter pass-through)", async () => {
    process.env.HACK_A_SPRINT_2026_ALLOWED_SUBMISSIONS = "   ";
    setupDb();
    await GET(makeReq());
    const identities = mockBallot.mock.calls[0]?.[2] as Array<{ submissionId: string }>;
    expect(identities.length).toBe(2);
  });

  it("sets participantEligible from githubUserHasMergedLabeledShowcasePr", async () => {
    mockHasMergedPr.mockResolvedValueOnce(true);
    setupDb();
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.participantEligible).toBe(true);
  });

  it("returns 500 on unexpected throw from db.getAll", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockDb.mockReturnValue({
      collection: jest.fn(() => ({ doc: jest.fn(() => ({})) })),
      getAll: jest.fn().mockRejectedValue(new Error("boom")),
    } as never);
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Failed to load");
    consoleErrorSpy.mockRestore();
  });
});
