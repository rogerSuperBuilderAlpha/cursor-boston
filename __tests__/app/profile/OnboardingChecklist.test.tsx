 

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingChecklist } from "@/app/(auth)/profile/_components/OnboardingChecklist";
import type { ProfileContextValue } from "@/app/(auth)/profile/_contexts/ProfileContext";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

jest.mock("firebase/auth", () => ({ getAuth: jest.fn() }));

const makeContext = (overrides: Partial<ProfileContextValue> = {}): ProfileContextValue => ({
  user: { photoURL: null, displayName: "Test" } as ProfileContextValue["user"],
  userProfile: { bio: "" } as ProfileContextValue["userProfile"],
  refreshUserProfile: jest.fn(),
  data: {
    stats: { pullRequestsCount: 0 },
    registrations: [],
    talkSubmissions: [],
    loadingData: false,
    connectedAgents: [],
    loadingAgents: false,
  } as unknown as ProfileContextValue["data"],
  badges: {} as ProfileContextValue["badges"],
  discord: { discordInfo: null, connect: jest.fn() } as unknown as ProfileContextValue["discord"],
  github: { githubInfo: null, connect: jest.fn() } as unknown as ProfileContextValue["github"],
  google: {} as ProfileContextValue["google"],
  mfa: {} as ProfileContextValue["mfa"],
  email: {} as ProfileContextValue["email"],
  profileSettings: {
    settings: { visibility: { isPublic: false } },
    togglePublic: jest.fn(),
  } as unknown as ProfileContextValue["profileSettings"],
  password: {} as ProfileContextValue["password"],
  signOut: jest.fn(),
  signOutError: null,
  isSigningOut: false,
  handleSignOut: jest.fn(),
  ...overrides,
});

let mockContextValue: ProfileContextValue;

jest.mock("@/app/(auth)/profile/_contexts/ProfileContext", () => ({
  useProfileContext: () => mockContextValue,
}));

describe("OnboardingChecklist", () => {
  beforeEach(() => {
    mockContextValue = makeContext();
  });

  it("renders checklist with progress", () => {
    render(<OnboardingChecklist />);
    expect(screen.getByText("Get Started")).toBeInTheDocument();
    // "Create your account" is always done
    expect(screen.getByText("Create your account")).toBeInTheDocument();
    expect(screen.getByText(/complete/)).toBeInTheDocument();
  });

  it("shows completed count correctly", () => {
    render(<OnboardingChecklist />);
    // Only "Create your account" is done by default
    expect(screen.getByText("1/7 complete")).toBeInTheDocument();
  });

  it("returns null when all items are done", () => {
    mockContextValue = makeContext({
      user: { photoURL: "https://img.com/photo.jpg", displayName: "Test" } as ProfileContextValue["user"],
      userProfile: { bio: "I build things" } as ProfileContextValue["userProfile"],
      data: {
        stats: { pullRequestsCount: 3 },
        registrations: [],
        talkSubmissions: [],
        loadingData: false,
        connectedAgents: [],
        loadingAgents: false,
      } as unknown as ProfileContextValue["data"],
      discord: { discordInfo: { username: "user#1234" }, connect: jest.fn() } as unknown as ProfileContextValue["discord"],
      github: { githubInfo: { login: "testuser" }, connect: jest.fn() } as unknown as ProfileContextValue["github"],
      profileSettings: {
        settings: { visibility: { isPublic: true } },
        togglePublic: jest.fn(),
      } as unknown as ProfileContextValue["profileSettings"],
    });
    const { container } = render(<OnboardingChecklist />);
    expect(container.innerHTML).toBe("");
  });

  it("renders connect buttons for incomplete social items", () => {
    render(<OnboardingChecklist />);
    expect(screen.getByText("Connect GitHub")).toBeInTheDocument();
    expect(screen.getByText("Connect Discord")).toBeInTheDocument();
  });

  it("calls github.connect when Connect GitHub is clicked", async () => {
    const user = userEvent.setup();
    render(<OnboardingChecklist />);
    // Find the button wrapping "Connect GitHub"
    const ghButton = screen.getByText("Connect GitHub").closest("button");
    expect(ghButton).toBeInTheDocument();
    await user.click(ghButton!);
    expect(mockContextValue.github.connect).toHaveBeenCalled();
  });

  it("shows connected status for GitHub when linked", () => {
    mockContextValue = makeContext({
      github: { githubInfo: { login: "octocat" }, connect: jest.fn() } as unknown as ProfileContextValue["github"],
    });
    render(<OnboardingChecklist />);
    expect(screen.getByText("Connected as octocat")).toBeInTheDocument();
  });

  it("renders external link for Submit a pull request", () => {
    render(<OnboardingChecklist />);
    expect(screen.getByText("Submit a pull request")).toBeInTheDocument();
    const link = screen.getByText("Submit a pull request").closest("a");
    expect(link).toHaveAttribute("href", "https://github.com/rogerSuperBuilderAlpha/cursor-boston");
  });
});
