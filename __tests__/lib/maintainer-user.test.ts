/**
 * @jest-environment node
 */
import { getUserGithubLoginFromFirestore } from "@/lib/maintainer-user";

// Mock the admin-db getter so we can drive every branch.
jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(),
}));

import { getAdminDb } from "@/lib/firebase-admin";

const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

function mockDocSnapshot(snapData: { exists: boolean; data?: () => Record<string, unknown> }) {
  return {
    collection: () => ({
      doc: () => ({
        get: async () => snapData,
      }),
    }),
  };
}

describe("maintainer-user — getUserGithubLoginFromFirestore", () => {
  beforeEach(() => {
    mockGetAdminDb.mockReset();
  });

  it("returns null when admin db is unavailable", async () => {
    mockGetAdminDb.mockReturnValue(null as unknown as ReturnType<typeof getAdminDb>);
    expect(await getUserGithubLoginFromFirestore("u1")).toBeNull();
  });

  it("returns null when the user doc does not exist", async () => {
    mockGetAdminDb.mockReturnValue(
      mockDocSnapshot({ exists: false }) as unknown as ReturnType<typeof getAdminDb>
    );
    expect(await getUserGithubLoginFromFirestore("u1")).toBeNull();
  });

  it("returns null when the user doc has no github field", async () => {
    mockGetAdminDb.mockReturnValue(
      mockDocSnapshot({ exists: true, data: () => ({}) }) as unknown as ReturnType<typeof getAdminDb>
    );
    expect(await getUserGithubLoginFromFirestore("u1")).toBeNull();
  });

  it("returns null when github field is not an object", async () => {
    mockGetAdminDb.mockReturnValue(
      mockDocSnapshot({ exists: true, data: () => ({ github: "not-an-object" }) }) as unknown as ReturnType<typeof getAdminDb>
    );
    expect(await getUserGithubLoginFromFirestore("u1")).toBeNull();
  });

  it("returns null when github.login is missing", async () => {
    mockGetAdminDb.mockReturnValue(
      mockDocSnapshot({ exists: true, data: () => ({ github: {} }) }) as unknown as ReturnType<typeof getAdminDb>
    );
    expect(await getUserGithubLoginFromFirestore("u1")).toBeNull();
  });

  it("returns null when github.login is empty/whitespace", async () => {
    mockGetAdminDb.mockReturnValue(
      mockDocSnapshot({
        exists: true,
        data: () => ({ github: { login: "   " } }),
      }) as unknown as ReturnType<typeof getAdminDb>
    );
    expect(await getUserGithubLoginFromFirestore("u1")).toBeNull();
  });

  it("returns the trimmed login when present", async () => {
    mockGetAdminDb.mockReturnValue(
      mockDocSnapshot({
        exists: true,
        data: () => ({ github: { login: "  octocat  " } }),
      }) as unknown as ReturnType<typeof getAdminDb>
    );
    expect(await getUserGithubLoginFromFirestore("u1")).toBe("octocat");
  });

  it("returns null when github.login is not a string", async () => {
    mockGetAdminDb.mockReturnValue(
      mockDocSnapshot({
        exists: true,
        data: () => ({ github: { login: 12345 } }),
      }) as unknown as ReturnType<typeof getAdminDb>
    );
    expect(await getUserGithubLoginFromFirestore("u1")).toBeNull();
  });
});
