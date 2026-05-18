/**
 * @jest-environment node
 */
import {
  getAllActiveProfiles,
  getPairProfile,
  getPairSessionsForUser,
  updatePairSession,
} from "@/lib/pair-programming/data";

const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => ({ __collection: args }),
  doc: (...args: unknown[]) => ({ __doc: args }),
  query: (...args: unknown[]) => ({ __query: args }),
  where: (...args: unknown[]) => ({ __where: args }),
  orderBy: (...args: unknown[]) => ({ __orderBy: args }),
  limit: (n: number) => ({ __limit: n }),
  serverTimestamp: () => "SERVER_TS",
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
}));

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

describe("lib/pair-programming/data", () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockGetDocs.mockReset();
    mockUpdateDoc.mockReset();
  });

  describe("getPairProfile", () => {
    it("returns null when db is unavailable", async () => {
      const fb = jest.requireMock("@/lib/firebase");
      fb.__setDb(null);
      expect(await getPairProfile("u1")).toBeNull();
      fb.__setDb({ __fake: true });
    });

    it("returns null when doc doesn't exist", async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      expect(await getPairProfile("u1")).toBeNull();
    });

    it("returns the profile with userId injected", async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: "u-a",
        data: () => ({ displayName: "A" }),
      });
      expect(await getPairProfile("u-a")).toEqual({ userId: "u-a", displayName: "A" });
    });
  });

  describe("getAllActiveProfiles", () => {
    it("returns [] when db is unavailable", async () => {
      const fb = jest.requireMock("@/lib/firebase");
      fb.__setDb(null);
      expect(await getAllActiveProfiles()).toEqual([]);
      fb.__setDb({ __fake: true });
    });

    it("maps docs to profiles with userId", async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: "u1", data: () => ({ displayName: "A" }) },
          { id: "u2", data: () => ({ displayName: "B" }) },
        ],
      });
      expect(await getAllActiveProfiles()).toEqual([
        { userId: "u1", displayName: "A" },
        { userId: "u2", displayName: "B" },
      ]);
    });
  });

  describe("getPairSessionsForUser", () => {
    it("returns [] when db is unavailable", async () => {
      const fb = jest.requireMock("@/lib/firebase");
      fb.__setDb(null);
      expect(await getPairSessionsForUser("u1")).toEqual([]);
      fb.__setDb({ __fake: true });
    });

    it("maps docs to sessions with id", async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: "s1", data: () => ({ participantIds: ["u1", "u2"] }) },
          { id: "s2", data: () => ({ participantIds: ["u1", "u3"] }) },
        ],
      });
      const out = await getPairSessionsForUser("u1");
      expect(out.map((s) => s.id)).toEqual(["s1", "s2"]);
    });
  });

  describe("updatePairSession", () => {
    it("throws when db is unavailable", async () => {
      const fb = jest.requireMock("@/lib/firebase");
      fb.__setDb(null);
      await expect(updatePairSession("s1", { status: "completed" } as unknown as Parameters<typeof updatePairSession>[1])).rejects.toThrow(
        "Firestore not initialized"
      );
      fb.__setDb({ __fake: true });
    });

    it("calls updateDoc with the merged payload + serverTimestamp", async () => {
      mockUpdateDoc.mockResolvedValueOnce(undefined);
      await updatePairSession("s1", { status: "completed" } as unknown as Parameters<typeof updatePairSession>[1]);
      expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
      const [, payload] = mockUpdateDoc.mock.calls[0];
      expect(payload).toMatchObject({
        status: "completed",
        updatedAt: "SERVER_TS",
      });
    });
  });
});
