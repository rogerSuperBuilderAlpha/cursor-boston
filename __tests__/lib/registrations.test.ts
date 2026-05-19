import {
  getUserStats,
  registerForEvent,
  getUserRegistrations,
  isUserRegistered,
} from "@/lib/registrations";
import { getDocs, getDoc, setDoc } from "firebase/firestore";

jest.mock("@/lib/firebase", () => ({
  db: { mocked: true },
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn((...args) => ({ kind: "collection", args })),
  doc: jest.fn((...args) => ({ kind: "doc", args })),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn((...args) => ({ kind: "query", args })),
  where: jest.fn((...args) => ({ kind: "where", args })),
  serverTimestamp: jest.fn(() => "serverTimestamp"),
  Timestamp: class Timestamp {},
}));

const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
const mockSetDoc = setDoc as jest.MockedFunction<typeof setDoc>;

describe("getUserStats", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("counts merged PRs from pullRequests documents", async () => {
    mockGetDocs
      .mockResolvedValueOnce({
        docs: [
          { data: () => ({ status: "registered" }) },
          { data: () => ({ status: "attended" }) },
        ],
      } as never)
      .mockResolvedValueOnce({
        size: 2,
        docs: [
          { data: () => ({ status: "pending" }) },
          { data: () => ({ status: "completed" }) },
        ],
      } as never)
      .mockResolvedValueOnce({
        size: 3,
        docs: [
          { data: () => ({ state: "merged" }) },
          { data: () => ({ state: "merged" }) },
          { data: () => ({ state: "merged" }) },
        ],
      } as never);

    const stats = await getUserStats("user-123");

    expect(stats).toEqual({
      eventsRegistered: 2,
      eventsAttended: 1,
      talksSubmitted: 2,
      talksGiven: 1,
      pullRequestsCount: 3,
    });
    expect(mockGetDocs).toHaveBeenCalledTimes(3);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  // Gold coverage push #12 — broader coverage

  it("returns zeroed stats when db is null", async () => {
    jest.resetModules();
    jest.doMock("@/lib/firebase", () => ({ db: null }));
    const { getUserStats: getZeroed } = await import("@/lib/registrations");
    const stats = await getZeroed("u1");
    expect(stats).toEqual({
      eventsRegistered: 0,
      eventsAttended: 0,
      talksSubmitted: 0,
      talksGiven: 0,
      pullRequestsCount: 0,
    });
  });
});

describe("registerForEvent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws when db is not configured", async () => {
    jest.resetModules();
    jest.doMock("@/lib/firebase", () => ({ db: null }));
    const { registerForEvent: regNull } = await import("@/lib/registrations");
    await expect(
      regNull("u1", "u@example.com", "User", "evt-1", "Evt"),
    ).rejects.toThrow("Firebase is not configured");
  });

  it("silently returns when already registered", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true } as never);
    await registerForEvent("u1", "u@example.com", "User", "evt-1", "Evt");
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it("writes registration doc with source=manual when no lumaGuestId", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false } as never);
    mockSetDoc.mockResolvedValue(undefined as never);
    await registerForEvent("u1", "u@example.com", "User", "evt-1", "Evt", "2026-06-01");
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: "u1_evt-1",
        eventId: "evt-1",
        eventTitle: "Evt",
        userId: "u1",
        userEmail: "u@example.com",
        userName: "User",
        eventDate: "2026-06-01",
        source: "manual",
        status: "registered",
      }),
    );
  });

  it("writes source=luma when lumaGuestId provided", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false } as never);
    mockSetDoc.mockResolvedValue(undefined as never);
    await registerForEvent(
      "u1",
      "u@example.com",
      "User",
      "evt-1",
      "Evt",
      undefined,
      "luma-guest-1",
    );
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        source: "luma",
        lumaGuestId: "luma-guest-1",
      }),
    );
  });
});

describe("getUserRegistrations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty array when db is null", async () => {
    jest.resetModules();
    jest.doMock("@/lib/firebase", () => ({ db: null }));
    const { getUserRegistrations: getNull } = await import("@/lib/registrations");
    const regs = await getNull("u1");
    expect(regs).toEqual([]);
  });

  it("returns mapped registrations from Firestore docs", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ id: "u1_e1", eventId: "e1" }) },
        { data: () => ({ id: "u1_e2", eventId: "e2" }) },
      ],
    } as never);
    const regs = await getUserRegistrations("u1");
    expect(regs).toEqual([
      { id: "u1_e1", eventId: "e1" },
      { id: "u1_e2", eventId: "e2" },
    ]);
  });
});

describe("isUserRegistered", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns false when db is null", async () => {
    jest.resetModules();
    jest.doMock("@/lib/firebase", () => ({ db: null }));
    const { isUserRegistered: isNull } = await import("@/lib/registrations");
    expect(await isNull("u1", "e1")).toBe(false);
  });

  it("returns true when registration document exists", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true } as never);
    expect(await isUserRegistered("u1", "e1")).toBe(true);
  });

  it("returns false when registration document does not exist", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false } as never);
    expect(await isUserRegistered("u1", "e1")).toBe(false);
  });
});
