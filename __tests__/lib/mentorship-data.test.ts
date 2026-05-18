/**
 * @jest-environment node
 */
import {
  getAllActiveMentorshipProfiles,
  getMentorshipPairingsForUser,
  getMentorshipProfile,
} from "@/lib/mentorship/data";

const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();

jest.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => ({ __collection: args }),
  doc: (...args: unknown[]) => ({ __doc: args }),
  query: (...args: unknown[]) => ({ __query: args }),
  where: (...args: unknown[]) => ({ __where: args }),
  orderBy: (...args: unknown[]) => ({ __orderBy: args }),
  limit: (n: number) => ({ __limit: n }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

jest.mock("@/lib/firebase", () => ({
  db: { __fake: true },
}));

// Re-importable mock toggle for the db: tests can override.
jest.mock("@/lib/firebase", () => {
  let _db: unknown = { __fake: true };
  return {
    get db() {
      return _db;
    },
    __setDb(next: unknown) {
      _db = next;
    },
  };
});

describe("lib/mentorship/data", () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockGetDocs.mockReset();
  });

  describe("getMentorshipProfile", () => {
    it("returns null when db is unavailable", async () => {
      const firebase = jest.requireMock("@/lib/firebase");
      firebase.__setDb(null);
      expect(await getMentorshipProfile("u1")).toBeNull();
      firebase.__setDb({ __fake: true });
    });

    it("returns null when the doc doesn't exist", async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      expect(await getMentorshipProfile("u1")).toBeNull();
    });

    it("returns the profile with userId injected when it exists", async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: "u-alice",
        data: () => ({ displayName: "Alice", bio: "Mentor" }),
      });
      const p = await getMentorshipProfile("u-alice");
      expect(p).toEqual({ userId: "u-alice", displayName: "Alice", bio: "Mentor" });
    });
  });

  describe("getAllActiveMentorshipProfiles", () => {
    it("returns [] when db is unavailable", async () => {
      const firebase = jest.requireMock("@/lib/firebase");
      firebase.__setDb(null);
      expect(await getAllActiveMentorshipProfiles()).toEqual([]);
      firebase.__setDb({ __fake: true });
    });

    it("maps each doc to a profile with userId injected", async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: "u1", data: () => ({ displayName: "A" }) },
          { id: "u2", data: () => ({ displayName: "B" }) },
        ],
      });
      const out = await getAllActiveMentorshipProfiles();
      expect(out).toEqual([
        { userId: "u1", displayName: "A" },
        { userId: "u2", displayName: "B" },
      ]);
    });

    it("returns an empty array when there are no matching profiles", async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      expect(await getAllActiveMentorshipProfiles()).toEqual([]);
    });
  });

  describe("getMentorshipPairingsForUser", () => {
    it("returns [] when db is unavailable", async () => {
      const firebase = jest.requireMock("@/lib/firebase");
      firebase.__setDb(null);
      expect(await getMentorshipPairingsForUser("u1")).toEqual([]);
      firebase.__setDb({ __fake: true });
    });

    it("unions mentor-side and mentee-side pairings, deduped by doc id", async () => {
      mockGetDocs
        .mockResolvedValueOnce({
          docs: [
            { id: "p-1", data: () => ({ mentorId: "u1", menteeId: "u2" }) },
            { id: "p-shared", data: () => ({ mentorId: "u1", menteeId: "u-other" }) },
          ],
        })
        .mockResolvedValueOnce({
          docs: [
            { id: "p-shared", data: () => ({ mentorId: "u1", menteeId: "u-other" }) }, // duplicate
            { id: "p-2", data: () => ({ mentorId: "u-other", menteeId: "u1" }) },
          ],
        });
      const out = await getMentorshipPairingsForUser("u1");
      expect(out.map((p) => p.id).sort()).toEqual(["p-1", "p-2", "p-shared"]);
    });

    it("returns an empty array when neither query returns docs", async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [] });
      expect(await getMentorshipPairingsForUser("u1")).toEqual([]);
    });
  });
});
