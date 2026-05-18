/**
 * @jest-environment node
 */
const mockEmailAlreadyWon = jest.fn();
jest.mock("@/lib/treasure-hunt-eligibility", () => ({
  emailAlreadyWon: (...a: unknown[]) => mockEmailAlreadyWon(...a),
}));

const mockSendEmail = jest.fn();
jest.mock("@/lib/mailgun", () => ({
  sendEmail: (...a: unknown[]) => mockSendEmail(...a),
}));

const afterCallbacks: Array<() => Promise<void>> = [];
jest.mock("next/server", () => ({
  after: (cb: () => Promise<void>) => {
    afterCallbacks.push(cb);
  },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => ({ __ts: "now" }),
    arrayUnion: (...vals: unknown[]) => ({ __arrayUnion: vals }),
  },
}));

import { claimTreasureHuntPrize } from "@/lib/treasure-hunt-claim";

function buildDb(opts: {
  progressExists?: boolean;
  progressHasPrize?: boolean;
  pathWinnerExists?: boolean;
  prizeDocs?: Array<{
    id: string;
    data: () => Record<string, unknown>;
    ref: Record<string, unknown>;
  }>;
  runtimeFails?: boolean;
}) {
  const progressRefUpdate = jest.fn();
  const progressRefSet = jest.fn().mockResolvedValue(undefined);
  const progressRef = {
    update: progressRefUpdate,
    set: progressRefSet,
  };

  const pathWinnerRef = {};
  const prizesQuery = { docs: opts.prizeDocs ?? [], empty: (opts.prizeDocs ?? []).length === 0 };
  const prizesChain = {
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  };

  const txGetMap = new Map<unknown, unknown>([
    [progressRef, opts.progressExists
      ? { exists: true, data: () => ({ prizeCodeId: opts.progressHasPrize ? "X" : null }) }
      : { exists: false, data: () => undefined }],
    [pathWinnerRef, { exists: !!opts.pathWinnerExists }],
    [prizesChain, prizesQuery],
  ]);

  const runtimeDoc = {
    set: opts.runtimeFails
      ? jest.fn().mockRejectedValue(new Error("runtime write failed"))
      : jest.fn().mockResolvedValue(undefined),
  };
  const runtimeChain = {
    doc: jest.fn().mockReturnValue(runtimeDoc),
  };

  const txUpdate = jest.fn();
  const txSet = jest.fn();
  const tx = {
    get: jest.fn(async (ref: unknown) => {
      // Reproduce the Promise.all([tx.get(progressRef), tx.get(pathWinnerRef)])
      // and the tx.get(query) calls — match by reference identity.
      return txGetMap.get(ref) ?? { exists: false, data: () => undefined };
    }),
    update: txUpdate,
    set: txSet,
  };

  const runTransaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx));

  const collection = jest.fn((name: string) => {
    switch (name) {
      case "treasureHuntProgress":
        return { doc: () => progressRef };
      case "treasureHuntPathWinners":
        return { doc: () => pathWinnerRef };
      case "treasureHuntPrizes":
        return prizesChain;
      case "treasureHuntRuntime":
        return runtimeChain;
      default:
        throw new Error(`unexpected: ${name}`);
    }
  });

  return {
    db: { collection, runTransaction } as unknown as Parameters<typeof claimTreasureHuntPrize>[0],
    spies: { progressRef, txUpdate, txSet, runtimeDoc },
  };
}

describe("lib/treasure-hunt-claim", () => {
  beforeEach(() => {
    mockEmailAlreadyWon.mockReset();
    mockEmailAlreadyWon.mockResolvedValue(false);
    mockSendEmail.mockReset();
    mockSendEmail.mockResolvedValue(undefined);
    afterCallbacks.length = 0;
  });

  it("rejects with no_email when email is blank/whitespace", async () => {
    const { db } = buildDb({});
    const out = await claimTreasureHuntPrize(db, {
      uid: "u1",
      email: "   ",
      displayName: "Alice",
      pathId: "path-a",
    });
    expect(out).toEqual({ ok: false, reason: "no_email" });
  });

  it("rejects when the email has already won under a different uid", async () => {
    mockEmailAlreadyWon.mockResolvedValueOnce(true);
    const { db } = buildDb({});
    const out = await claimTreasureHuntPrize(db, {
      uid: "u1",
      email: "user@x.com",
      displayName: "Alice",
      pathId: "path-a",
    });
    expect(out).toEqual({ ok: false, reason: "email_already_won" });
    expect(mockEmailAlreadyWon).toHaveBeenCalledWith(expect.anything(), "user@x.com");
  });

  it("rejects with already_won when this uid already has a prizeCodeId", async () => {
    const { db } = buildDb({
      progressExists: true,
      progressHasPrize: true,
    });
    const out = await claimTreasureHuntPrize(db, {
      uid: "u1",
      email: "user@x.com",
      displayName: "Alice",
      pathId: "path-a",
    });
    expect(out).toEqual({ ok: false, reason: "already_won" });
  });

  it("rejects with path_taken when the pathWinner index doc already exists", async () => {
    const { db } = buildDb({
      pathWinnerExists: true,
    });
    const out = await claimTreasureHuntPrize(db, {
      uid: "u1",
      email: "user@x.com",
      displayName: "Alice",
      pathId: "path-a",
    });
    expect(out).toEqual({ ok: false, reason: "path_taken" });
  });

  it("rejects with pool_empty when no available prize matches the query", async () => {
    const { db } = buildDb({ prizeDocs: [] });
    const out = await claimTreasureHuntPrize(db, {
      uid: "u1",
      email: "user@x.com",
      displayName: "Alice",
      pathId: "path-a",
    });
    expect(out).toEqual({ ok: false, reason: "pool_empty" });
  });

  it("awards the first available prize and returns code + creditUrl + pathId", async () => {
    const prizeRef = {};
    const { db, spies } = buildDb({
      prizeDocs: [
        {
          id: "PRIZE-1",
          data: () => ({ creditUrl: "https://cursor.com/credit/abc" }),
          ref: prizeRef,
        },
      ],
    });
    const out = await claimTreasureHuntPrize(db, {
      uid: "u1",
      email: "User@X.com",
      displayName: "  Alice  ",
      pathId: "path-a",
    });
    expect(out).toEqual({
      ok: true,
      code: "PRIZE-1",
      creditUrl: "https://cursor.com/credit/abc",
      pathId: "path-a",
    });
    // Tx wrote claim payload onto the prize ref
    expect(spies.txUpdate).toHaveBeenCalledWith(
      prizeRef,
      expect.objectContaining({
        status: "claimed",
        claimedByUid: "u1",
        claimedByEmail: "User@X.com",
        claimedPath: "path-a",
      }),
    );
    // Path winner index written
    expect(spies.txSet).toHaveBeenCalledTimes(2);
    const [winnerRef, winnerPayload] = spies.txSet.mock.calls[0];
    expect(winnerRef).toBeDefined();
    expect(winnerPayload).toMatchObject({
      pathId: "path-a",
      winnerUid: "u1",
      winnerEmail: "User@X.com",
      prizeCodeId: "PRIZE-1",
    });
    // Progress doc upsert with arrayUnion + null prizeEmailSentAt
    const progressPayload = spies.txSet.mock.calls[1][1];
    expect(progressPayload).toMatchObject({
      uid: "u1",
      winnerEmail: "User@X.com",
      winnerEmailLower: "user@x.com",
      prizeCodeId: "PRIZE-1",
      prizeCreditUrl: "https://cursor.com/credit/abc",
      prizeEmailSentAt: null,
    });
  });

  it("clears the email-retry 'queue empty' marker (best-effort)", async () => {
    const { db, spies } = buildDb({
      prizeDocs: [
        { id: "PRIZE", data: () => ({ creditUrl: "https://x" }), ref: {} },
      ],
    });
    await claimTreasureHuntPrize(db, {
      uid: "u1",
      email: "u@x.com",
      displayName: "Alice",
      pathId: "p1",
    });
    expect(spies.runtimeDoc.set).toHaveBeenCalledWith(
      expect.objectContaining({ queueEmpty: false }),
      { merge: true },
    );
  });

  it("ignores a failed runtime marker write (try/catch)", async () => {
    const { db } = buildDb({
      prizeDocs: [{ id: "PRIZE", data: () => ({ creditUrl: "https://x" }), ref: {} }],
      runtimeFails: true,
    });
    const out = await claimTreasureHuntPrize(db, {
      uid: "u1",
      email: "u@x.com",
      displayName: "Alice",
      pathId: "p1",
    });
    expect(out.ok).toBe(true);
  });

  it("queues an after() callback that sends the prize email", async () => {
    const { db, spies } = buildDb({
      prizeDocs: [
        { id: "PRIZE-1", data: () => ({ creditUrl: "https://x/credit" }), ref: {} },
      ],
    });
    await claimTreasureHuntPrize(db, {
      uid: "u1",
      email: "user@x.com",
      displayName: "Alice",
      pathId: "path-a",
    });
    expect(afterCallbacks).toHaveLength(1);
    // Invoke the queued callback
    await afterCallbacks[0]!();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const args = mockSendEmail.mock.calls[0][0];
    expect(args.to).toBe("user@x.com");
    expect(args.subject).toContain("Cursor credit");
    expect(args.text).toContain("path-a");
    expect(args.html).toContain("https://x/credit");
    // Progress doc was patched with prizeEmailSentAt after send succeeded
    expect(spies.progressRef.set).toHaveBeenCalledWith(
      { prizeEmailSentAt: { __ts: "now" } },
      { merge: true },
    );
  });

  it("falls back to 'there' when displayName is blank", async () => {
    const { db } = buildDb({
      prizeDocs: [
        { id: "PRIZE-1", data: () => ({ creditUrl: "https://x/credit" }), ref: {} },
      ],
    });
    await claimTreasureHuntPrize(db, {
      uid: "u1",
      email: "user@x.com",
      displayName: "   ",
      pathId: "path-a",
    });
    await afterCallbacks[0]!();
    const args = mockSendEmail.mock.calls[0][0];
    expect(args.text).toContain("Hi there,");
  });

  it("swallows a failed email send (logs but doesn't throw)", async () => {
    mockSendEmail.mockRejectedValueOnce(new Error("upstream 502"));
    const consoleErrSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { db } = buildDb({
      prizeDocs: [
        { id: "PRIZE-1", data: () => ({ creditUrl: "https://x" }), ref: {} },
      ],
    });
    await claimTreasureHuntPrize(db, {
      uid: "u1",
      email: "u@x.com",
      displayName: "Alice",
      pathId: "p1",
    });
    await afterCallbacks[0]!();
    expect(consoleErrSpy).toHaveBeenCalled();
    consoleErrSpy.mockRestore();
  });
});
