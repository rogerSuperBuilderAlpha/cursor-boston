/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/AuthContext";
import { SettingsTab } from "@/app/(auth)/profile/_components/SettingsTab";
import type { ProfileSettings } from "@/app/(auth)/profile/_hooks/useProfileSettings";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;

const defaultSettings: ProfileSettings = {
  bio: "Builder in Boston",
  location: "Cambridge, MA",
  company: "Cursor Boston",
  jobTitle: "Organizer",
  socialLinks: {
    website: "https://example.com",
    linkedIn: "",
    twitter: "",
    github: "https://github.com/wave6",
    substack: "",
  },
  visibility: {
    isPublic: false,
    showEmail: false,
    showBio: true,
    showLocation: true,
    showCompany: true,
    showJobTitle: true,
    showDiscord: true,
    showGithubBadge: true,
    showEventsAttended: true,
    showTalksGiven: true,
    showWebsite: true,
    showLinkedIn: true,
    showTwitter: true,
    showGithub: true,
    showSubstack: true,
    showMemberSince: true,
  },
};

function renderTab(
  overrides: Partial<{
    settings: ProfileSettings;
    saving: boolean;
    error: string | null;
    success: boolean;
    onSave: jest.Mock;
    onToggleAllVisibility: jest.Mock;
    setSettings: jest.Mock;
  }> = {},
) {
  const setSettings = jest.fn();
  const onSave = jest.fn().mockResolvedValue(undefined);
  const onToggleAllVisibility = jest.fn();
  const props = {
    settings: defaultSettings,
    setSettings,
    saving: false,
    error: null,
    success: false,
    onSave,
    onToggleAllVisibility,
    ...overrides,
  };
  const view = render(<SettingsTab {...props} />);
  return { ...view, ...props };
}

describe("SettingsTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("settings-user"),
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ onList: true, subscribed: true }),
    });
  });

  it("renders profile fields and public profile toggle copy", async () => {
    renderTab();

    expect(screen.getByLabelText(/^Bio$/i, { selector: "textarea" })).toHaveValue(
      "Builder in Boston",
    );
    expect(screen.getByText(/Your profile is hidden from the Members page/i)).toBeInTheDocument();
    expect(await screen.findByText(/Event Email Updates/i)).toBeInTheDocument();
  });

  it("updates bio through setSettings", async () => {
    const user = userEvent.setup();
    const { setSettings } = renderTab();

    const bio = screen.getByLabelText(/^Bio$/i, { selector: "textarea" });
    await user.clear(bio);
    await user.type(bio, "Updated bio");

    expect(setSettings).toHaveBeenCalled();
  });

  it("toggles public profile visibility", async () => {
    const user = userEvent.setup();
    const { setSettings } = renderTab();

    await user.click(screen.getByRole("checkbox", { name: /Public profile/i }));

    expect(setSettings).toHaveBeenCalled();
  });

  it("calls onToggleAllVisibility from show/hide all buttons", async () => {
    const user = userEvent.setup();
    const { onToggleAllVisibility } = renderTab();

    await user.click(screen.getByRole("button", { name: /Show All/i }));
    await user.click(screen.getByRole("button", { name: /Hide All/i }));

    expect(onToggleAllVisibility).toHaveBeenCalledWith(true);
    expect(onToggleAllVisibility).toHaveBeenCalledWith(false);
  });

  it("patches email subscription when toggled", async () => {
    const user = userEvent.setup();
    renderTab();

    const emailToggle = await screen.findByRole("checkbox", {
      name: /Event email updates/i,
    });
    await user.click(emailToggle);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/profile/subscription",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ subscribed: false }),
        }),
      );
    });
  });

  it("invokes onSave from the save button", async () => {
    const user = userEvent.setup();
    const { onSave } = renderTab();

    await user.click(screen.getByRole("button", { name: /Save Settings/i }));
    expect(onSave).toHaveBeenCalled();
  });

  it("shows saving label and error or success messages", () => {
    const { rerender } = render(
      <SettingsTab
        settings={defaultSettings}
        setSettings={jest.fn()}
        saving={true}
        error={null}
        success={false}
        onSave={jest.fn()}
        onToggleAllVisibility={jest.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /Saving.../i })).toBeDisabled();

    rerender(
      <SettingsTab
        settings={defaultSettings}
        setSettings={jest.fn()}
        saving={false}
        error="Save failed"
        success={false}
        onSave={jest.fn()}
        onToggleAllVisibility={jest.fn()}
      />,
    );
    expect(screen.getByText("Save failed")).toBeInTheDocument();

    rerender(
      <SettingsTab
        settings={defaultSettings}
        setSettings={jest.fn()}
        saving={false}
        error={null}
        success={true}
        onSave={jest.fn()}
        onToggleAllVisibility={jest.fn()}
      />,
    );
    expect(screen.getByText(/Settings saved successfully/i)).toBeInTheDocument();
  });
});
