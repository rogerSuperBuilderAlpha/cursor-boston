/**
 * @jest-environment node
 */

import {
  PairRequestNotFoundError,
  respondToPairRequestServer,
} from "@/lib/pair-programming/data-server";
import { getAdminDb } from "@/lib/firebase-admin";

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

describe("respondToPairRequestServer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("treats an undefined transaction payload as not found", async () => {
    const requestRef = { id: "request-1" };

    mockGetAdminDb.mockReturnValue({
      collection: jest.fn((name: string) => ({
        doc: jest.fn(() =>
          name === "pair_requests"
            ? requestRef
            : { id: "session-1" }
        ),
      })),
      runTransaction: jest.fn(async (callback: (transaction: { get: jest.Mock }) => unknown) =>
        callback({
          get: jest.fn(async () => ({
            exists: true,
            data: () => undefined,
          })),
        })
      ),
    } as never);

    await expect(
      respondToPairRequestServer("request-1", "user-1", "accept")
    ).rejects.toBeInstanceOf(PairRequestNotFoundError);
  });
});
