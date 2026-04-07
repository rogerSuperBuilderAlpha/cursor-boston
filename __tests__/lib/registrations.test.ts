import { getUserStats } from "@/lib/registrations";
import { getDocs, getDoc } from "firebase/firestore";

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
});
