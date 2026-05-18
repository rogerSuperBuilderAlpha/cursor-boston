/**
 * @jest-environment node
 */
const mockAddDoc = jest.fn();
const mockCollection = jest.fn();
const mockServerTimestamp = jest.fn(() => "ST" as unknown as Date);

jest.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

jest.mock("@/lib/firebase", () => {
  let _db: unknown = { __fake: "db" };
  return {
    get db() {
      return _db;
    },
    __setDb(next: unknown) {
      _db = next;
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const firebaseMod = require("@/lib/firebase") as { __setDb: (db: unknown) => void };
const setDb = firebaseMod.__setDb;

import {
  submitEventRequest,
  submitTalkProposal,
} from "@/lib/submissions";

const originalFetch = global.fetch;

describe("lib/submissions", () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockCollection.mockReset();
    mockServerTimestamp.mockClear();
    setDb({ __fake: "db" });
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response);
    mockCollection.mockImplementation((db, name) => ({ __collRef: name }));
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe("submitTalkProposal", () => {
    const baseTalk = {
      name: "A",
      email: "a@x.com",
      title: "T",
      description: "D",
      category: "AI",
      duration: "15-20 min",
      experience: "intermediate",
    };

    it("throws when db is unset", async () => {
      setDb(null);
      await expect(submitTalkProposal(baseTalk)).rejects.toThrow(
        "Firebase is not configured",
      );
    });

    it("stores the submission in talkSubmissions and returns the new doc id", async () => {
      mockAddDoc.mockResolvedValueOnce({ id: "talk-123" });
      const id = await submitTalkProposal(baseTalk, "uid-7");
      expect(id).toBe("talk-123");
      expect(mockCollection).toHaveBeenCalledWith({ __fake: "db" }, "talkSubmissions");
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      const [, payload] = mockAddDoc.mock.calls[0];
      expect(payload).toEqual({
        ...baseTalk,
        userId: "uid-7",
        status: "pending",
        createdAt: "ST",
      });
    });

    it("defaults userId to null when not provided", async () => {
      mockAddDoc.mockResolvedValueOnce({ id: "talk-456" });
      await submitTalkProposal(baseTalk);
      const [, payload] = mockAddDoc.mock.calls[0];
      expect(payload.userId).toBeNull();
    });

    it("POSTs to /api/notify-admin/talk with the submissionId", async () => {
      mockAddDoc.mockResolvedValueOnce({ id: "talk-id" });
      await submitTalkProposal(baseTalk, "uid");
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/notify-admin/talk",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      expect(body.submissionId).toBe("talk-id");
      expect(body.title).toBe("T");
    });

    it("swallows fetch failures (submission is already saved)", async () => {
      mockAddDoc.mockResolvedValueOnce({ id: "talk-id-ok" });
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("net down"));
      const id = await submitTalkProposal(baseTalk);
      expect(id).toBe("talk-id-ok");
    });

    it("propagates errors from addDoc (write failure surfaces)", async () => {
      mockAddDoc.mockRejectedValueOnce(new Error("firestore write failed"));
      await expect(submitTalkProposal(baseTalk)).rejects.toThrow(
        "firestore write failed",
      );
    });
  });

  describe("submitEventRequest", () => {
    const baseEvent = {
      name: "B",
      email: "b@x.com",
      eventType: "workshop",
      title: "Title",
      description: "Desc",
      expectedAttendees: "30",
    };

    it("throws when db is unset", async () => {
      setDb(null);
      await expect(submitEventRequest(baseEvent)).rejects.toThrow(
        "Firebase is not configured",
      );
    });

    it("stores the request in eventRequests and returns the new doc id", async () => {
      mockAddDoc.mockResolvedValueOnce({ id: "ev-1" });
      const id = await submitEventRequest(baseEvent, "uid-9");
      expect(id).toBe("ev-1");
      expect(mockCollection).toHaveBeenCalledWith({ __fake: "db" }, "eventRequests");
      const [, payload] = mockAddDoc.mock.calls[0];
      expect(payload).toEqual({
        ...baseEvent,
        userId: "uid-9",
        status: "pending",
        createdAt: "ST",
      });
    });

    it("defaults userId to null when not provided", async () => {
      mockAddDoc.mockResolvedValueOnce({ id: "ev-2" });
      await submitEventRequest(baseEvent);
      const [, payload] = mockAddDoc.mock.calls[0];
      expect(payload.userId).toBeNull();
    });

    it("POSTs to /api/notify-admin/event with the requestId", async () => {
      mockAddDoc.mockResolvedValueOnce({ id: "ev-id" });
      await submitEventRequest(baseEvent);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/notify-admin/event",
        expect.objectContaining({
          method: "POST",
        }),
      );
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      expect(body.requestId).toBe("ev-id");
      expect(body.eventType).toBe("workshop");
    });

    it("swallows fetch failures (request is already saved)", async () => {
      mockAddDoc.mockResolvedValueOnce({ id: "ev-ok" });
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("dns fail"));
      const id = await submitEventRequest(baseEvent);
      expect(id).toBe("ev-ok");
    });

    it("propagates errors from addDoc", async () => {
      mockAddDoc.mockRejectedValueOnce(new Error("perm denied"));
      await expect(submitEventRequest(baseEvent)).rejects.toThrow("perm denied");
    });
  });
});
