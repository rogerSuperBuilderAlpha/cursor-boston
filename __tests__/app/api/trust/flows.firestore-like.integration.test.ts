/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

jest.mock("@/content/showcase.json", () => ({
  projects: [{ id: "project-1" }],
}));

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

jest.mock("@/lib/rate-limit", () => ({
  getClientIdentifier: jest.fn(() => "test-ip"),
}));

jest.mock("@/lib/rate-limit-server", () => ({
  checkServerRateLimit: jest.fn(async () => ({ success: true, retryAfter: 0 })),
  buildRateLimitHeaders: jest.fn(() => ({})),
}));

let currentUser: { uid: string; email?: string; isAdmin?: boolean } | null = null;

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(async () => currentUser),
}));

const FIXED_DATE = new Date("2026-03-23T00:00:00.000Z");

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => ({ __op: "serverTimestamp" }),
    arrayUnion: (...values: unknown[]) => ({ __op: "arrayUnion", values }),
  },
  Timestamp: {
    now: () => ({
      toDate: () => FIXED_DATE,
    }),
  },
}));

type WhereOp = "==" | "array-contains" | "<=";

type WhereClause = {
  field: string;
  op: WhereOp;
  value: unknown;
};

type DocData = Record<string, unknown>;

function getPath(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, data);
}

function isSpecialOp(value: unknown): value is { __op: string; values?: unknown[] } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "__op" in (value as Record<string, unknown>)
  );
}

function deepResolve(
  next: unknown,
  prev: unknown
): unknown {
  if (isSpecialOp(next)) {
    if (next.__op === "serverTimestamp") {
      return {
        toDate: () => new Date(FIXED_DATE),
      };
    }

    if (next.__op === "arrayUnion") {
      const base = Array.isArray(prev) ? [...prev] : [];
      for (const value of next.values || []) {
        base.push(value);
      }
      return base;
    }
  }

  if (!next || typeof next !== "object" || Array.isArray(next)) {
    return next;
  }

  const prevObj = prev && typeof prev === "object" && !Array.isArray(prev)
    ? (prev as Record<string, unknown>)
    : {};

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(next as Record<string, unknown>)) {
    out[key] = deepResolve(value, prevObj[key]);
  }
  return out;
}

class FirestoreLikeDb {
  private readonly store = new Map<string, Map<string, DocData>>();

  private ensureCollection(name: string): Map<string, DocData> {
    if (!this.store.has(name)) {
      this.store.set(name, new Map());
    }
    return this.store.get(name)!;
  }

  seed(collection: string, id: string, data: DocData) {
    this.ensureCollection(collection).set(id, data);
  }

  read(collection: string, id: string): DocData | undefined {
    return this.ensureCollection(collection).get(id);
  }

  list(collection: string): Array<{ id: string; data: DocData }> {
    return Array.from(this.ensureCollection(collection).entries()).map(([id, data]) => ({
      id,
      data,
    }));
  }

  collection(name: string) {
    return new CollectionRef(this, name, []);
  }

  batch() {
    const operations: Array<() => Promise<void>> = [];
    return {
      set: (
        docRef: { set: (data: DocData, options?: { merge?: boolean }) => Promise<void> },
        data: DocData,
        options?: { merge?: boolean }
      ) => {
        operations.push(() => docRef.set(data, options));
      },
      commit: async () => {
        for (const op of operations) {
          await op();
        }
      },
    };
  }

  _getCollectionData(name: string) {
    return this.ensureCollection(name);
  }
}

class CollectionRef {
  constructor(
    private readonly db: FirestoreLikeDb,
    private readonly name: string,
    private readonly whereClauses: WhereClause[],
    private readonly limitCount?: number
  ) {}

  where(field: string, op: WhereOp, value: unknown) {
    return new CollectionRef(this.db, this.name, [...this.whereClauses, { field, op, value }], this.limitCount);
  }

  limit(count: number) {
    return new CollectionRef(this.db, this.name, this.whereClauses, count);
  }

  orderBy() {
    return this;
  }

  doc(id: string) {
    return new DocRef(this.db, this.name, id);
  }

  async get() {
    const collection = this.db._getCollectionData(this.name);
    let docs = Array.from(collection.entries()).map(([id, data]) => ({
      id,
      data,
    }));

    docs = docs.filter(({ data }) => {
      return this.whereClauses.every((clause) => {
        const actual = getPath(data, clause.field);
        if (clause.op === "==") {
          return actual === clause.value;
        }
        if (clause.op === "array-contains") {
          return Array.isArray(actual) && actual.includes(clause.value);
        }
        if (clause.op === "<=") {
          if (typeof actual === "number" && typeof clause.value === "number") {
            return actual <= clause.value;
          }
          return false;
        }
        return false;
      });
    });

    if (typeof this.limitCount === "number") {
      docs = docs.slice(0, this.limitCount);
    }

    return {
      empty: docs.length === 0,
      size: docs.length,
      docs: docs.map((doc) => ({
        id: doc.id,
        data: () => doc.data,
        ref: new DocRef(this.db, this.name, doc.id),
      })),
    };
  }
}

class DocRef {
  constructor(
    private readonly db: FirestoreLikeDb,
    private readonly collectionName: string,
    readonly id: string
  ) {}

  async get() {
    const existing = this.db._getCollectionData(this.collectionName).get(this.id);
    return {
      exists: Boolean(existing),
      data: () => existing,
    };
  }

  async set(data: DocData, options?: { merge?: boolean }) {
    const collection = this.db._getCollectionData(this.collectionName);
    const existing = collection.get(this.id) || {};
    const resolved = deepResolve(data, existing) as DocData;

    if (options?.merge) {
      collection.set(this.id, { ...existing, ...resolved });
    } else {
      collection.set(this.id, resolved);
    }
  }
}

let db: FirestoreLikeDb;

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => db),
}));

import { POST as submitShowcase } from "@/app/api/showcase/submission/route";
import { POST as moderateShowcase } from "@/app/api/showcase/submission/approve/route";
import { POST as moderateTalk } from "@/app/api/talks/submission/moderate/route";
import { POST as awardBadges } from "@/app/api/badges/awards/route";

function post(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Firestore-like trust flow integration", () => {
  beforeEach(() => {
    db = new FirestoreLikeDb();
    currentUser = null;
    process.env.ADMIN_EMAILS = "admin@example.com";
    process.env.ADMIN_EMAIL = "";
  });

  it("showcase submit creates pending then admin approve persists status", async () => {
    currentUser = { uid: "u1", email: "member@example.com" };

    const createRes = await submitShowcase(
      post("http://localhost/api/showcase/submission", { projectId: "project-1" })
    );
    const createBody = await createRes.json();

    expect(createRes.status).toBe(200);
    expect(createBody.status).toBe("pending");

    const submissionId = "u1_project-1";
    expect(db.read("showcaseSubmissions", submissionId)?.status).toBe("pending");

    currentUser = { uid: "admin1", email: "admin@example.com", isAdmin: true };

    const approveRes = await moderateShowcase(
      post("http://localhost/api/showcase/submission/approve", {
        submissionId,
        action: "approve",
      })
    );
    const approveBody = await approveRes.json();

    expect(approveRes.status).toBe(200);
    expect(approveBody.status).toBe("approved");
    expect(db.read("showcaseSubmissions", submissionId)?.status).toBe("approved");
  });

  it("showcase reject then user resubmission moves record back to pending", async () => {
    currentUser = { uid: "u2", email: "member@example.com" };

    await submitShowcase(post("http://localhost/api/showcase/submission", { projectId: "project-1" }));
    const submissionId = "u2_project-1";

    currentUser = { uid: "admin1", email: "admin@example.com", isAdmin: true };
    await moderateShowcase(
      post("http://localhost/api/showcase/submission/approve", {
        submissionId,
        action: "reject",
      })
    );

    expect(db.read("showcaseSubmissions", submissionId)?.status).toBe("rejected");

    currentUser = { uid: "u2", email: "member@example.com" };
    const resubmitRes = await submitShowcase(
      post("http://localhost/api/showcase/submission", { projectId: "project-1" })
    );
    const resubmitBody = await resubmitRes.json();

    expect(resubmitRes.status).toBe(200);
    expect(resubmitBody).toEqual(expect.objectContaining({ resubmitted: true, status: "pending" }));
    expect(db.read("showcaseSubmissions", submissionId)?.status).toBe("pending");
  });

  it("talk moderation approve then complete persists completed status", async () => {
    db.seed("talkSubmissions", "talk-1", {
      userId: "speaker-1",
      title: "A Talk",
      status: "pending",
    });

    currentUser = { uid: "admin1", email: "admin@example.com", isAdmin: true };

    const approveRes = await moderateTalk(
      post("http://localhost/api/talks/submission/moderate", {
        submissionId: "talk-1",
        action: "approve",
      })
    );
    expect(approveRes.status).toBe(200);
    expect(db.read("talkSubmissions", "talk-1")?.status).toBe("approved");

    const completeRes = await moderateTalk(
      post("http://localhost/api/talks/submission/moderate", {
        submissionId: "talk-1",
        action: "complete",
      })
    );
    const completeBody = await completeRes.json();

    expect(completeRes.status).toBe(200);
    expect(completeBody.status).toBe("completed");
    expect(db.read("talkSubmissions", "talk-1")?.status).toBe("completed");
  });

  it("badge awards uses persisted eligibility signals and writes user_badges", async () => {
    const userId = "u3";
    db.seed("users", userId, {
      displayName: "Speaker",
      visibility: { isPublic: false },
      bio: "",
      photoURL: "",
      pullRequestsCount: 0,
    });
    db.seed("talkSubmissions", "talk-speaker", {
      userId,
      status: "completed",
    });

    currentUser = { uid: userId, email: "member@example.com" };

    const awardRes = await awardBadges(post("http://localhost/api/badges/awards", {}));
    const awardBody = await awardRes.json();

    expect(awardRes.status).toBe(200);
    expect(awardBody.eligibleBadgeIds).toContain("speaker");
    expect(db.read("user_badges", `${userId}_speaker`)).toEqual(
      expect.objectContaining({
        userId,
        badgeId: "speaker",
        awardSource: "system",
      })
    );

    const secondAwardRes = await awardBadges(post("http://localhost/api/badges/awards", {}));
    expect(secondAwardRes.status).toBe(200);
    const speakerDocs = db
      .list("user_badges")
      .filter(({ data }) => data.userId === userId && data.badgeId === "speaker");
    expect(speakerDocs).toHaveLength(1);
  });
});
