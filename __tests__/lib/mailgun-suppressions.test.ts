/**
 * @jest-environment node
 */
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => ({ __ts: "now" }),
  },
}));

import {
  __resetMailgunSuppressionsMemo,
  syncMailgunSuppressions,
} from "@/lib/mailgun-suppressions";

const originalFetch = global.fetch;

function mkRes(body: unknown, ok = true, status = 200, text = ""): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => text,
  } as unknown as Response;
}

interface FakeDocSnap {
  id: string;
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
}

function buildFakeDb(opts: {
  eventContacts?: Record<string, Record<string, unknown>>;
  // direct doc lookup by email
  eventContactsByEmail?: Record<string, FakeDocSnap>;
  // query: where("email", "==", email).limit(1) → match
  eventContactsByQuery?: Record<string, FakeDocSnap>;
  usersByEmail?: Record<string, FakeDocSnap>;
}) {
  const eventContactDocSet = jest.fn().mockResolvedValue(undefined);
  const usersDocSet = jest.fn().mockResolvedValue(undefined);

  function chainOf(getMap: Record<string, FakeDocSnap>) {
    const where = jest.fn();
    const limit = jest.fn();
    const get = jest.fn(() => {
      const email = where.mock.calls.at(-1)?.[2];
      const match = email ? getMap[email] : undefined;
      return Promise.resolve({
        empty: !match,
        docs: match ? [match] : [],
      });
    });
    where.mockReturnValue({ where, limit, get });
    limit.mockReturnValue({ where, limit, get });
    return { where, limit, get };
  }

  const eventContactsChain = chainOf(opts.eventContactsByQuery ?? {});
  const usersChain = chainOf(opts.usersByEmail ?? {});

  const eventContactsCol = {
    doc: jest.fn((email: string) => {
      const snap = opts.eventContactsByEmail?.[email];
      return {
        get: jest.fn().mockResolvedValue(
          snap ?? { id: email, exists: false, data: () => undefined },
        ),
        set: eventContactDocSet,
      };
    }),
    where: eventContactsChain.where,
  };
  const usersCol = {
    doc: jest.fn(() => ({ set: usersDocSet })),
    where: usersChain.where,
  };

  const collection = jest.fn((name: string) => {
    if (name === "eventContacts") return eventContactsCol;
    if (name === "users") return usersCol;
    throw new Error(`unexpected: ${name}`);
  });

  return {
    db: { collection } as unknown as Parameters<typeof syncMailgunSuppressions>[0],
    spies: { eventContactDocSet, usersDocSet, eventContactsChain, usersChain },
  };
}

describe("lib/mailgun-suppressions", () => {
  beforeEach(() => {
    __resetMailgunSuppressionsMemo();
    global.fetch = jest.fn();
    delete process.env.MAILGUN_PRIVATE_API_KEY;
    delete process.env.MAILGUN_DOMAIN;
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("skips when MAILGUN_PRIVATE_API_KEY is missing", async () => {
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    const { db } = buildFakeDb({});
    const out = await syncMailgunSuppressions(db);
    expect(out.skipped).toBe(true);
    expect(out.skippedReason).toMatch(/MAILGUN_PRIVATE_API_KEY/);
    expect(out.allSuppressed.size).toBe(0);
  });

  it("skips when MAILGUN_DOMAIN is missing", async () => {
    process.env.MAILGUN_PRIVATE_API_KEY = "x";
    const { db } = buildFakeDb({});
    const out = await syncMailgunSuppressions(db);
    expect(out.skipped).toBe(true);
    expect(out.skippedReason).toMatch(/MAILGUN_DOMAIN/);
  });

  it("returns no-op result when bounce + complaint lists are empty", async () => {
    process.env.MAILGUN_PRIVATE_API_KEY = "key";
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    (global.fetch as jest.Mock).mockResolvedValue(
      mkRes({ items: [], paging: { next: null } }),
    );
    const { db } = buildFakeDb({});
    const out = await syncMailgunSuppressions(db);
    expect(out.skipped).toBe(false);
    expect(out.allSuppressed.size).toBe(0);
    expect(out.flaggedEventContacts).toBe(0);
    expect(out.flaggedUsers).toBe(0);
  });

  it("merges bounces + complaints into allSuppressed (lowercase, deduped — bounce wins on conflict)", async () => {
    process.env.MAILGUN_PRIVATE_API_KEY = "key";
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/bounces")) {
        return Promise.resolve(
          mkRes({
            items: [
              { address: "Alice@x.com", code: 550, error: "blocked" },
              { address: "", code: 0 },
            ],
          }),
        );
      }
      if (url.includes("/complaints")) {
        return Promise.resolve(
          mkRes({
            items: [
              { address: "alice@X.com", code: 999, error: "complained" },
              { address: "bob@y.com", code: 999 },
              { address: "  ", code: 0 },
            ],
          }),
        );
      }
      return Promise.resolve(mkRes({ items: [] }));
    });
    const { db } = buildFakeDb({});
    const out = await syncMailgunSuppressions(db);
    expect([...out.allSuppressed].sort()).toEqual([
      "alice@x.com",
      "bob@y.com",
    ]);
    expect(out.bouncedCount).toBe(2);
    expect(out.complaintsCount).toBe(3);
  });

  it("writes flags onto eventContacts (direct id) and users (queried by email)", async () => {
    process.env.MAILGUN_PRIVATE_API_KEY = "key";
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/bounces")) {
        return Promise.resolve(
          mkRes({
            items: [{ address: "alice@x.com", code: 550, error: "blocked" }],
          }),
        );
      }
      return Promise.resolve(mkRes({ items: [] }));
    });
    const { db, spies } = buildFakeDb({
      eventContactsByEmail: {
        "alice@x.com": {
          id: "alice@x.com",
          exists: true,
          data: () => ({ email: "alice@x.com" }),
        },
      },
      usersByEmail: {
        "alice@x.com": {
          id: "user-1",
          exists: true,
          data: () => ({ email: "alice@x.com" }),
        },
      },
    });
    const out = await syncMailgunSuppressions(db);
    expect(out.flaggedEventContacts).toBe(1);
    expect(out.flaggedUsers).toBe(1);
    expect(spies.eventContactDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        unsubscribed: true,
        suppressionReason: "mailgun-bounce",
        suppressionCode: "550",
        suppressionError: "blocked",
      }),
      { merge: true },
    );
    expect(spies.usersDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        unsubscribed: true,
        unsubscribedReason: "mailgun-suppression",
      }),
      { merge: true },
    );
  });

  it("uses mailgun-complaint reason for complaint-sourced flags + null payload for empty code/error", async () => {
    process.env.MAILGUN_PRIVATE_API_KEY = "key";
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/complaints")) {
        return Promise.resolve(
          mkRes({ items: [{ address: "carol@x.com" }] }),
        );
      }
      return Promise.resolve(mkRes({ items: [] }));
    });
    const { db, spies } = buildFakeDb({
      eventContactsByEmail: {
        "carol@x.com": {
          id: "carol@x.com",
          exists: true,
          data: () => ({}),
        },
      },
    });
    await syncMailgunSuppressions(db);
    expect(spies.eventContactDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        suppressionReason: "mailgun-complaint",
        suppressionCode: null,
        suppressionError: null,
      }),
      { merge: true },
    );
  });

  it("skips event contacts already unsubscribed with bouncedAt", async () => {
    process.env.MAILGUN_PRIVATE_API_KEY = "key";
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/bounces")) {
        return Promise.resolve(
          mkRes({ items: [{ address: "dave@x.com" }] }),
        );
      }
      return Promise.resolve(mkRes({ items: [] }));
    });
    const { db, spies } = buildFakeDb({
      eventContactsByEmail: {
        "dave@x.com": {
          id: "dave@x.com",
          exists: true,
          data: () => ({ unsubscribed: true, bouncedAt: { x: 1 } }),
        },
      },
    });
    const out = await syncMailgunSuppressions(db);
    expect(out.flaggedEventContacts).toBe(0);
    expect(spies.eventContactDocSet).not.toHaveBeenCalled();
  });

  it("falls back to eventContacts where('email','==',email) query when direct doc id misses", async () => {
    process.env.MAILGUN_PRIVATE_API_KEY = "key";
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/bounces")) {
        return Promise.resolve(
          mkRes({ items: [{ address: "eve@x.com" }] }),
        );
      }
      return Promise.resolve(mkRes({ items: [] }));
    });
    const { db } = buildFakeDb({
      eventContactsByQuery: {
        "eve@x.com": {
          id: "ec-eve",
          exists: true,
          data: () => ({ email: "eve@x.com" }),
        },
      },
    });
    const out = await syncMailgunSuppressions(db);
    expect(out.flaggedEventContacts).toBe(1);
  });

  it("memoizes the result and skips refetch on second call without force:true", async () => {
    process.env.MAILGUN_PRIVATE_API_KEY = "key";
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    (global.fetch as jest.Mock).mockResolvedValue(mkRes({ items: [] }));
    const { db } = buildFakeDb({});
    const a = await syncMailgunSuppressions(db);
    const b = await syncMailgunSuppressions(db);
    expect(a).toBe(b);
    expect(global.fetch).toHaveBeenCalledTimes(2); // first call hits twice (bounces + complaints), second call memoized
  });

  it("refetches when force:true is passed", async () => {
    process.env.MAILGUN_PRIVATE_API_KEY = "key";
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    (global.fetch as jest.Mock).mockResolvedValue(mkRes({ items: [] }));
    const { db } = buildFakeDb({});
    await syncMailgunSuppressions(db);
    await syncMailgunSuppressions(db, { force: true });
    expect(global.fetch).toHaveBeenCalledTimes(4); // 2 (first run) + 2 (forced re-run)
  });

  it("clears memo on transport error so a retry is possible", async () => {
    process.env.MAILGUN_PRIVATE_API_KEY = "key";
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    (global.fetch as jest.Mock).mockResolvedValue(
      mkRes({}, false, 500, "internal"),
    );
    const { db } = buildFakeDb({});
    await expect(syncMailgunSuppressions(db)).rejects.toThrow(
      /Mailgun .* fetch failed/,
    );
    // Second call should attempt fresh fetch (memo was cleared)
    (global.fetch as jest.Mock).mockResolvedValue(mkRes({ items: [] }));
    const out = await syncMailgunSuppressions(db);
    expect(out.skipped).toBe(false);
  });

  it("follows paging.next until items=0 (caps at 50 pages)", async () => {
    process.env.MAILGUN_PRIVATE_API_KEY = "key";
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    let bounceCalls = 0;
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/bounces")) {
        bounceCalls++;
        if (bounceCalls === 1) {
          return Promise.resolve(
            mkRes({
              items: [{ address: "a@x.com" }],
              paging: { next: `${url}&page=2` },
            }),
          );
        }
        return Promise.resolve(mkRes({ items: [] }));
      }
      return Promise.resolve(mkRes({ items: [] }));
    });
    const { db } = buildFakeDb({});
    await syncMailgunSuppressions(db);
    expect(bounceCalls).toBeGreaterThanOrEqual(2);
  });

  it("respects verbose:false (no console.log lines emitted)", async () => {
    process.env.MAILGUN_PRIVATE_API_KEY = "key";
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    (global.fetch as jest.Mock).mockResolvedValue(mkRes({ items: [] }));
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    logSpy.mockClear();
    const { db } = buildFakeDb({});
    await syncMailgunSuppressions(db, { verbose: false });
    expect(logSpy).not.toHaveBeenCalled();
  });
});
