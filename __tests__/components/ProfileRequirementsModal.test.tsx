/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import ProfileRequirementsModal from "@/components/ProfileRequirementsModal";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;

const metProfile = {
  displayName: "Test User",
  hasDisplayName: true,
  hasGithub: true,
  githubUsername: "octo",
  hasDiscord: true,
  discordUsername: "octo#0001",
  visibility: { isPublic: true, showDiscord: true },
  photoURL: null,
};

const unmetProfile = {
  displayName: null,
  hasDisplayName: false,
  hasGithub: false,
  githubUsername: null,
  hasDiscord: false,
  discordUsername: null,
  visibility: { isPublic: false, showDiscord: false },
  photoURL: null,
};

describe("ProfileRequirementsModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as typeof fetch;
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      refreshUserProfile: jest.fn(),
      loading: false,
    });
  });

  it("renders requirement rows when open", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, profile: unmetProfile }),
    }) as typeof fetch;

    render(
      <ProfileRequirementsModal
        isOpen
        onClose={jest.fn()}
        requirements={["hasGithub", "hasDisplayName"]}
        title="Complete your profile"
      />,
    );
    expect(screen.getByText(/Complete your profile/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/GitHub Connected/i)).toBeInTheDocument();
    });
  });

  it("returns null when closed", () => {
    const fetchMock = global.fetch as jest.Mock;
    const { container } = render(
      <ProfileRequirementsModal
        isOpen={false}
        onClose={jest.fn()}
        requirements={["hasGithub"]}
      />,
    );
    expect(container.firstChild).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls onClose when the dismiss control is clicked", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, profile: unmetProfile }),
    }) as typeof fetch;

    const onClose = jest.fn();
    render(
      <ProfileRequirementsModal
        isOpen
        onClose={onClose}
        requirements={["hasGithub"]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/GitHub Connected/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("invokes onComplete when all requirements are met", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, profile: metProfile }),
    }) as typeof fetch;

    const onComplete = jest.fn();
    render(
      <ProfileRequirementsModal
        isOpen
        onClose={jest.fn()}
        onComplete={onComplete}
        requirements={["hasGithub", "hasDisplayName", "isPublic"]}
      />,
    );

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });
});
