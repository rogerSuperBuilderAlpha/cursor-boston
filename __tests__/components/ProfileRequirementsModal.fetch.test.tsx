/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import ProfileRequirementsModal from "@/components/ProfileRequirementsModal";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;

describe("ProfileRequirementsModal fetch", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      refreshUserProfile: jest.fn(),
      loading: false,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        profile: {
          displayName: "Test User",
          hasDisplayName: true,
          hasGithub: false,
          githubUsername: null,
          hasDiscord: false,
          discordUsername: null,
          visibility: { isPublic: false, showDiscord: false },
          photoURL: null,
        },
      }),
    }) as typeof fetch;
  });

  it("loads profile visibility when open", async () => {
    render(
      <ProfileRequirementsModal
        isOpen
        onClose={jest.fn()}
        requirements={["hasGithub", "isPublic"]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/GitHub Connected/i)).toBeInTheDocument();
    });
  });
});
