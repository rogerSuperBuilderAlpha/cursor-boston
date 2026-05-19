/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { getPairProfile } from "@/lib/pair-programming/data";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

jest.mock("@/lib/pair-programming/data", () => ({
  getPairProfile: jest.fn(),
  getAllActiveProfiles: jest.fn().mockResolvedValue([]),
  getPairSessionsForUser: jest.fn().mockResolvedValue([]),
}));

const mockGetPairProfile = getPairProfile as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

describe("pair page signed in", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("uid-1"),
      loading: false,
    });
    mockGetPairProfile.mockResolvedValue(null);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as typeof fetch;
  });

  it("renders pair hub for signed-in user", async () => {
    const Page = (await import("@/app/pair/page")).default;
    const { container } = render(<Page />);
    await waitFor(
      () => {
        expect(container.textContent?.length ?? 0).toBeGreaterThan(40);
      },
      { timeout: 4000 },
    );
  });
});
