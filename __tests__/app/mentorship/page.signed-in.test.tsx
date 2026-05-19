/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, waitFor } from "@testing-library/react";
import { getDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { getMentorshipProfile } from "@/lib/mentorship/data";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

jest.mock("@/lib/mentorship/data", () => ({
  getMentorshipProfile: jest.fn(),
  getAllActiveMentorshipProfiles: jest.fn().mockResolvedValue([]),
  getMentorshipPairingsForUser: jest.fn().mockResolvedValue([]),
}));

const mockGetDoc = getDoc as jest.Mock;
const mockGetMentorshipProfile = getMentorshipProfile as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

describe("mentorship page signed in", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("uid-1"),
      loading: false,
    });
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        displayName: "Mentor User",
        photoURL: null,
      }),
    });
    mockGetMentorshipProfile.mockResolvedValue(null);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ matches: [] }),
    }) as typeof fetch;
  });

  it("renders mentorship hub for signed-in user", async () => {
    const Page = (await import("@/app/mentorship/page")).default;
    const { container } = render(<Page />);
    await waitFor(
      () => {
        expect(container.textContent?.length ?? 0).toBeGreaterThan(40);
      },
      { timeout: 4000 },
    );
  });
});
