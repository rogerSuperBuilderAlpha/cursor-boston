/**
 * @jest-environment node
 */
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/summer-cohort", () => ({
  SUMMER_COHORT_C1_AUTO_ADMIT_DEADLINE_MS: 9_999_999_999_999,
  SUMMER_COHORT_C1_CAP: 200,
  SUMMER_COHORT_COLLECTION: "summerCohortApplications",
  isWithinSummerCohortC1AutoAdmitWindow: jest.fn(() => true),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => ({ __ts: "now" }),
  },
}));

import { maybeAutoAdmitOnPRMerge } from "@/lib/summer-cohort-auto-admit";
import { getAdminDb } from "@/lib/firebase-admin";
import { isWithinSummerCohortC1AutoAdmitWindow } from "@/lib/summer-cohort";

const getAdminDbMock = getAdminDb as jest.MockedFunction<typeof getAdminDb>;
const inWindowMock = isWithinSummerCohortC1AutoAdmitWindow as jest.MockedFunction<typeof isWithinSummerCohortC1AutoAdmitWindow>;

type UserDoc = { id: string };

function mkUsersSnap(docs: UserDoc[]) {
  return { docs };
}

interface AppFixture {
  exists?: boolean;
  status?: string;
  cohorts?: unknown;
}

function buildDb(opts: {
  primaryUsers?: UserDoc[];
  fallbackUsers?: UserDoc[];
  appByUid?: Record<string, AppFixture>;
  admittedCount?: number;
  // Force isWithinSummerCohortC1AutoAdmitWindow to flip during the transaction
  windowClosesMidTx?: boolean;
}) {
  const updateSpy = jest.fn();
  const txnInsideWindowAfter = !opts.windowClosesMidTx;
  const usersGet = jest
    .fn()
    .mockResolvedValueOnce(mkUsersSnap(opts.primaryUsers ?? []))
    .mockResolvedValueOnce(mkUsersSnap(opts.fallbackUsers ?? []));

  const usersChain = {
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: usersGet,
  };

  const countAgg = {
    get: jest.fn().mockResolvedValue({
      data: () => ({ count: opts.admittedCount ?? 0 }),
    }),
  };
  const cohortChain = {
    where: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnValue(countAgg),
  };

  const cohortDocMap: Record<string, { update: jest.Mock; appRef: { __uid: string } }> = {};
  const cohortCollection = {
    doc: jest.fn((uid: string) => {
      const ref = (cohortDocMap[uid] ??= {
        update: updateSpy,
        appRef: { __uid: uid },
      });
      return ref.appRef;
    }),
    where: cohortChain.where,
    count: cohortChain.count,
  } as unknown as ReturnType<typeof getAdminDbMock>;

  // Provide a where(...).where(...).count() chain when count() is called via
  // db.collection(...).where(...).where(...).count()
  Object.assign(cohortCollection, cohortChain);

  const runTransaction = jest.fn(async (fn) => {
    const tx = {
      get: jest.fn((ref: { __uid: string }) => {
        const f = opts.appByUid?.[ref.__uid];
        if (!f || f.exists === false) {
          return Promise.resolve({ exists: false, data: () => undefined });
        }
        return Promise.resolve({
          exists: true,
          data: () => ({ status: f.status, cohorts: f.cohorts }),
        });
      }),
      update: updateSpy,
    };
    if (opts.windowClosesMidTx) {
      // Outer guard already fired with the default (true).
      // Force the in-txn re-check to return false.
      inWindowMock.mockImplementationOnce(() => false);
    }
    return fn(tx);
  });

  const collection = jest.fn((name: string) => {
    if (name === "users") return usersChain;
    if (name === "summerCohortApplications") return cohortCollection;
    throw new Error(`unexpected collection: ${name}`);
  });

  return {
    db: { collection, runTransaction } as unknown as ReturnType<typeof getAdminDb>,
    updateSpy,
    usersChain,
    cohortChain,
    runTransaction,
    txnInsideWindowAfter,
  };
}

describe("lib/summer-cohort-auto-admit", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    inWindowMock.mockReturnValue(true);
  });

  it("skips when authorLogin is empty", async () => {
    const out = await maybeAutoAdmitOnPRMerge({ authorLogin: "", prNumber: 1 });
    expect(out).toEqual({ kind: "skipped", reason: "no-author-login" });
  });

  it("skips when outside the auto-admit window", async () => {
    inWindowMock.mockReturnValueOnce(false);
    const out = await maybeAutoAdmitOnPRMerge({ authorLogin: "alice", prNumber: 1 });
    expect(out.kind).toBe("skipped");
    if (out.kind === "skipped") expect(out.reason).toBe("outside-auto-admit-window");
  });

  it("skips when admin db is null", async () => {
    getAdminDbMock.mockReturnValueOnce(null as unknown as ReturnType<typeof getAdminDb>);
    const out = await maybeAutoAdmitOnPRMerge({ authorLogin: "alice", prNumber: 1 });
    expect(out).toEqual({ kind: "skipped", reason: "no-admin-db" });
  });

  it("skips when no user has that github.login (and no lowercase fallback because login is already lowercase)", async () => {
    const { db, usersChain } = buildDb({});
    getAdminDbMock.mockReturnValueOnce(db);
    const out = await maybeAutoAdmitOnPRMerge({ authorLogin: "alice", prNumber: 1 });
    expect(out).toEqual({
      kind: "skipped",
      reason: "no-user-with-this-github-login",
    });
    // Only the primary lookup happened (login is already lowercase).
    expect(usersChain.get).toHaveBeenCalledTimes(1);
  });

  it("falls back to lowercase login lookup when mixed-case primary misses", async () => {
    const { db, usersChain } = buildDb({
      primaryUsers: [],
      fallbackUsers: [{ id: "uA" }],
      appByUid: { uA: { exists: false } },
    });
    getAdminDbMock.mockReturnValueOnce(db);
    const out = await maybeAutoAdmitOnPRMerge({ authorLogin: "AliCe", prNumber: 5 });
    expect(usersChain.get).toHaveBeenCalledTimes(2);
    expect(out.kind).toBe("skipped");
  });

  it("returns no-eligible-application when no candidate user has a pending cohort-1 app", async () => {
    const { db } = buildDb({
      primaryUsers: [{ id: "u1" }],
      appByUid: { u1: { exists: false } },
    });
    getAdminDbMock.mockReturnValueOnce(db);
    const out = await maybeAutoAdmitOnPRMerge({ authorLogin: "alice", prNumber: 1 });
    expect(out).toEqual({
      kind: "skipped",
      reason: "no-eligible-application",
    });
  });

  it("skips a user whose application is not pending", async () => {
    const { db } = buildDb({
      primaryUsers: [{ id: "u1" }],
      appByUid: { u1: { exists: true, status: "rejected", cohorts: ["cohort-1"] } },
    });
    getAdminDbMock.mockReturnValueOnce(db);
    const out = await maybeAutoAdmitOnPRMerge({ authorLogin: "alice", prNumber: 1 });
    expect(out).toEqual({
      kind: "skipped",
      reason: "no-eligible-application",
    });
  });

  it("skips a user whose application is missing cohort-1", async () => {
    const { db } = buildDb({
      primaryUsers: [{ id: "u1" }],
      appByUid: { u1: { exists: true, status: "pending", cohorts: ["cohort-2"] } },
    });
    getAdminDbMock.mockReturnValueOnce(db);
    const out = await maybeAutoAdmitOnPRMerge({ authorLogin: "alice", prNumber: 1 });
    expect(out).toEqual({
      kind: "skipped",
      reason: "no-eligible-application",
    });
  });

  it("skips when the cohort-1 cap has already been reached", async () => {
    const { db, updateSpy } = buildDb({
      primaryUsers: [{ id: "u1" }],
      appByUid: { u1: { exists: true, status: "pending", cohorts: ["cohort-1"] } },
      admittedCount: 200,
    });
    getAdminDbMock.mockReturnValueOnce(db);
    const out = await maybeAutoAdmitOnPRMerge({ authorLogin: "alice", prNumber: 9 });
    expect(out).toEqual({
      kind: "skipped",
      reason: "no-eligible-application",
    });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("skips when the deadline elapsed between guard and transaction body", async () => {
    const { db, updateSpy } = buildDb({
      primaryUsers: [{ id: "u1" }],
      appByUid: { u1: { exists: true, status: "pending", cohorts: ["cohort-1"] } },
      windowClosesMidTx: true,
    });
    getAdminDbMock.mockReturnValueOnce(db);
    const out = await maybeAutoAdmitOnPRMerge({ authorLogin: "alice", prNumber: 1 });
    expect(out).toEqual({
      kind: "skipped",
      reason: "no-eligible-application",
    });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("promotes a pending cohort-1 user when all gates pass", async () => {
    const { db, updateSpy } = buildDb({
      primaryUsers: [{ id: "uX" }],
      appByUid: { uX: { exists: true, status: "pending", cohorts: ["cohort-1"] } },
      admittedCount: 10,
    });
    getAdminDbMock.mockReturnValueOnce(db);
    const out = await maybeAutoAdmitOnPRMerge({ authorLogin: "alice", prNumber: 42 });
    expect(out).toEqual({
      kind: "promoted",
      userId: "uX",
      applicationId: "uX",
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const updatePayload = updateSpy.mock.calls[0][1];
    expect(updatePayload).toMatchObject({
      status: "admitted",
      admittedVia: "pr-merge",
      admittedFromPR: 42,
    });
  });

  it("treats non-string status as 'pending' (Firestore data is loose)", async () => {
    const { db, updateSpy } = buildDb({
      primaryUsers: [{ id: "uX" }],
      appByUid: { uX: { exists: true, status: undefined, cohorts: ["cohort-1"] } },
    });
    getAdminDbMock.mockReturnValueOnce(db);
    const out = await maybeAutoAdmitOnPRMerge({ authorLogin: "alice", prNumber: 1 });
    expect(out.kind).toBe("promoted");
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it("treats non-array cohorts as []", async () => {
    const { db } = buildDb({
      primaryUsers: [{ id: "uX" }],
      appByUid: { uX: { exists: true, status: "pending", cohorts: "not-array" } },
    });
    getAdminDbMock.mockReturnValueOnce(db);
    const out = await maybeAutoAdmitOnPRMerge({ authorLogin: "alice", prNumber: 1 });
    expect(out.kind).toBe("skipped");
  });

  it("returns 'exception' (non-fatal) when the transaction throws", async () => {
    const { db } = buildDb({
      primaryUsers: [{ id: "u1" }],
      appByUid: { u1: { exists: true, status: "pending", cohorts: ["cohort-1"] } },
    });
    (db as unknown as { runTransaction: jest.Mock }).runTransaction =
      jest.fn().mockRejectedValueOnce(new Error("aborted"));
    getAdminDbMock.mockReturnValueOnce(db);
    const out = await maybeAutoAdmitOnPRMerge({ authorLogin: "alice", prNumber: 1 });
    expect(out).toEqual({ kind: "skipped", reason: "exception" });
  });

  it("stops scanning after the first user is promoted (multi-user case)", async () => {
    const { db, updateSpy } = buildDb({
      primaryUsers: [{ id: "u1" }, { id: "u2" }],
      appByUid: {
        u1: { exists: true, status: "pending", cohorts: ["cohort-1"] },
        u2: { exists: true, status: "pending", cohorts: ["cohort-1"] },
      },
    });
    getAdminDbMock.mockReturnValueOnce(db);
    const out = await maybeAutoAdmitOnPRMerge({ authorLogin: "alice", prNumber: 1 });
    expect(out).toEqual({
      kind: "promoted",
      userId: "u1",
      applicationId: "u1",
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });
});
