/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
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

describe("mentorship page active profile", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("uid-1"),
      loading: false,
    });
    mockGetMentorshipProfile.mockResolvedValue({
      userId: "uid-1",
      role: "mentor",
      isActive: true,
      bio: "I help with OSS",
      expertise: ["typescript"],
      learningGoals: [],
      preferredLanguages: ["en"],
      timezone: "America/New_York",
      availability: [{ day: 1, startHour: 9, endHour: 12 }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        displayName: "Mentor User",
        photoURL: null,
      }),
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        matches: [
          {
            userId: "uid-2",
            score: 0.9,
            reasons: ["skills overlap"],
          },
        ],
      }),
    }) as typeof fetch;
  });

  it("renders matches when profile is active", async () => {
    const Page = (await import("@/app/mentorship/page")).default;
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByText(/Mentorship Matching/i)).toBeInTheDocument();
      expect(screen.getByText(/Expertise:/i)).toBeInTheDocument();
    });
  });
});
