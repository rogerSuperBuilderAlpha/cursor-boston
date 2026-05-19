/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
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

describe("pair page active profile", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("uid-1"),
      loading: false,
    });
    mockGetPairProfile.mockResolvedValue({
      userId: "uid-1",
      isActive: true,
      bio: "Pair on game features",
      skills: ["react"],
      timezone: "America/New_York",
      availability: [{ day: 2, startHour: 18, endHour: 21 }],
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, sessions: [] }),
    }) as typeof fetch;
  });

  it("renders pair hub with profile loaded", async () => {
    const Page = (await import("@/app/pair/page")).default;
    const { container } = render(<Page />);
    await waitFor(() => {
      expect(container.textContent?.length ?? 0).toBeGreaterThan(80);
    });
  });
});
