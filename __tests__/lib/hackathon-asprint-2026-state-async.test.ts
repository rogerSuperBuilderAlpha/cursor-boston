/**
 * @jest-environment node
 *
 * Async/Firestore-coupled helpers in lib/hackathon-asprint-2026-state.ts.
 * Heavy use of mock-builder helpers to drive every code path without
 * standing up a real Firestore. Complements the pure-helper tests in
 * __tests__/lib/hackathon-asprint-2026-state.test.ts.
 */
import type { Firestore } from "firebase-admin/firestore";
import {
  getAllHackASprint2026ParticipantScoreDocs,
  getParticipantScoresForUser,
  resolveVoterGithubByUid,
  userHackASprint2026PeerVoteComplete,
  userHasHackASprint2026Signup,
  userIsCheckedInForHackASprint2026,
} from "@/lib/hackathon-asprint-2026-state";
import type { SubmissionIdentity } from "@/lib/hackathon-asprint-2026-participant-scoring";

type DocRow = { id: string; data: Record<string, unknown> };

function fakeDb(opts: {
  signupExists?: boolean;
  signupData?: Record<string, unknown>;
  userData?: Record<string, unknown>;
  participantDoc?: { exists: boolean; data?: Record<string, unknown> };
  allParticipantDocs?: DocRow[];
  getAllResults?: DocRow[];
}): Firestore {
  return {
    collection: (name: string) => ({
      doc: (_id: string) => ({
        get: async () => {
          if (name === "hackathonEventSignups") {
            return {
              exists: !!opts.signupExists,
              data: () => opts.signupData,
            };
          }
          if (name === "users") {
            return {
              exists: !!opts.userData,
              data: () => opts.userData,
            };
          }
          if (name === "hackathonASprint2026ParticipantScores") {
            return {
              exists: !!opts.participantDoc?.exists,
              data: () => opts.participantDoc?.data,
            };
          }
          return { exists: false, data: () => undefined };
        },
      }),
      where: () => ({
        limit: () => ({
          get: async () => ({
            docs: (opts.allParticipantDocs ?? []).map((r) => ({
              id: r.id,
              data: () => r.data,
            })),
          }),
        }),
      }),
    }),
    getAll: async (..._refs: unknown[]) =>
      (opts.getAllResults ?? []).map((r) => ({
        id: r.id,
        data: () => r.data,
      })),
  } as unknown as Firestore;
}

describe("hackathon-asprint-2026-state async helpers", () => {
  describe("userHasHackASprint2026Signup", () => {
    it("returns true when the signup doc exists", async () => {
      expect(await userHasHackASprint2026Signup(fakeDb({ signupExists: true, signupData: {} }), "u1")).toBe(true);
    });

    it("returns false when no signup doc exists", async () => {
      expect(await userHasHackASprint2026Signup(fakeDb({}), "u1")).toBe(false);
    });
  });

  describe("userIsCheckedInForHackASprint2026", () => {
    it("returns true when the signup has a checkedInAt timestamp", async () => {
      const db = fakeDb({
        signupExists: true,
        signupData: { checkedInAt: new Date() },
      });
      expect(await userIsCheckedInForHackASprint2026(db, "u1")).toBe(true);
    });

    it("delegates to the judge-exception path when signup has no checkedInAt", async () => {
      const db = fakeDb({
        signupExists: true,
        signupData: {},
        userData: { email: "ray@vectorly.app" }, // judge email
      });
      expect(await userIsCheckedInForHackASprint2026(db, "u1")).toBe(true);
    });

    it("returns false when neither signup check-in nor judge exception applies", async () => {
      const db = fakeDb({
        signupExists: true,
        signupData: {},
        userData: { email: "participant@example.com" },
      });
      expect(await userIsCheckedInForHackASprint2026(db, "u1")).toBe(false);
    });
  });

  describe("userHackASprint2026PeerVoteComplete", () => {
    const subs: SubmissionIdentity[] = [
      { submissionId: "Sub-A", githubLogin: "alice" },
      { submissionId: "Sub-B", githubLogin: "bob" },
    ];

    it("returns false when the participant scores doc does not exist", async () => {
      const db = fakeDb({ participantDoc: { exists: false } });
      expect(await userHackASprint2026PeerVoteComplete(db, "u1", subs, "alice")).toBe(false);
    });

    it("returns true when scores cover every other submission", async () => {
      const db = fakeDb({
        participantDoc: { exists: true, data: { scores: { "sub-b": 7 } } },
      });
      expect(await userHackASprint2026PeerVoteComplete(db, "u1", subs, "alice")).toBe(true);
    });

    it("returns false when scores are incomplete", async () => {
      const db = fakeDb({
        participantDoc: { exists: true, data: { scores: {} } },
      });
      expect(await userHackASprint2026PeerVoteComplete(db, "u1", subs, "alice")).toBe(false);
    });
  });

  describe("getParticipantScoresForUser", () => {
    it("returns {} when the doc is missing", async () => {
      const db = fakeDb({ participantDoc: { exists: false } });
      expect(await getParticipantScoresForUser(db, "u1")).toEqual({});
    });

    it("returns normalized scores when the doc exists", async () => {
      const db = fakeDb({
        participantDoc: {
          exists: true,
          data: { scores: { "Sub-A": 5, "Sub-B": 11 /* dropped */, "Sub-C": "7" } },
        },
      });
      expect(await getParticipantScoresForUser(db, "u1")).toEqual({ "sub-a": 5, "sub-c": 7 });
    });
  });

  describe("getAllHackASprint2026ParticipantScoreDocs", () => {
    it("derives userId from the doc id when data.userId is missing", async () => {
      const db = fakeDb({
        allParticipantDocs: [
          { id: "evt__u-octocat", data: { scores: { "sub-a": 7 }, githubLogin: "OctoCat" } },
        ],
      });
      const rows = await getAllHackASprint2026ParticipantScoreDocs(db);
      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe("u-octocat");
      expect(rows[0].githubLogin).toBe("octocat");
      expect(rows[0].scores).toEqual({ "sub-a": 7 });
    });

    it("uses data.userId when present (overrides id fallback)", async () => {
      const db = fakeDb({
        allParticipantDocs: [
          { id: "evt__wrong", data: { userId: "u-right", scores: {} } },
        ],
      });
      const rows = await getAllHackASprint2026ParticipantScoreDocs(db);
      expect(rows[0].userId).toBe("u-right");
    });

    it("filters out rows with no resolvable userId", async () => {
      const db = fakeDb({
        allParticipantDocs: [
          { id: "noseparator", data: { scores: {} } },
          { id: "evt__u-1", data: { scores: { "sub-a": 7 } } },
        ],
      });
      const rows = await getAllHackASprint2026ParticipantScoreDocs(db);
      expect(rows.map((r) => r.userId)).toEqual(["u-1"]);
    });
  });

  describe("resolveVoterGithubByUid", () => {
    it("uses denormalized githubLogin where present", async () => {
      const db = fakeDb({});
      const out = await resolveVoterGithubByUid(db, [
        { userId: "u1", scores: {}, githubLogin: "Alice" },
      ]);
      expect(out.get("u1")).toBe("alice");
    });

    it("falls back to db.getAll for users missing githubLogin", async () => {
      const db = fakeDb({
        getAllResults: [
          { id: "u-missing", data: { github: { login: "Bob" } } },
        ],
      });
      const out = await resolveVoterGithubByUid(db, [
        { userId: "u-missing", scores: {} },
      ]);
      expect(out.get("u-missing")).toBe("bob");
    });

    it("returns the map unchanged when no users are missing githubLogin", async () => {
      const db = fakeDb({}); // getAll should not be needed
      const out = await resolveVoterGithubByUid(db, [
        { userId: "u1", scores: {}, githubLogin: "alice" },
      ]);
      expect(out.size).toBe(1);
    });

    it("skips getAll entries with no github.login", async () => {
      const db = fakeDb({
        getAllResults: [{ id: "u-anon", data: {} }],
      });
      const out = await resolveVoterGithubByUid(db, [{ userId: "u-anon", scores: {} }]);
      expect(out.size).toBe(0);
    });
  });
});
