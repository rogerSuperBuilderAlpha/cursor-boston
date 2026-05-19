/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import * as AuthContext from "@/contexts/AuthContext";
import HackASprintPage from "@/app/hackathons/hack-a-sprint-2026/page";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/hackathons/hack-a-sprint-2026",
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = AuthContext.useAuth as jest.Mock;

const EMPTY_VIEWER = {
  checkedIn: false,
  signedUp: false,
  hasCompletedPeerVoting: false,
  judgeEligible: false,
  isJudge: false,
  peerScoresRevealed: false,
  myParticipantScores: {},
  canPeerVote: false,
  isSubmitter: false,
};

function mockHackASprintFetch(opts?: { signedIn?: boolean }) {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/submissions")) {
      return {
        ok: true,
        json: async () => ({
          phase: "submissionOpen",
          viewer: EMPTY_VIEWER,
          submissions: [],
        }),
      };
    }
    if (url.includes("/me")) {
      return {
        ok: true,
        json: async () => ({
          phase: "submissionOpen",
          signedUp: true,
          checkedIn: true,
          hasCompletedPeerVoting: false,
          prizeEligible: true,
          highScoreCount: 3,
          requiredHighScores: 3,
          participantEligible: true,
          judgeEligible: false,
          githubLogin: "testuser",
        }),
      };
    }
    if (url.includes("/credit-code")) {
      return { ok: true, json: async () => ({ eligible: false }) };
    }
    return { ok: true, json: async () => ({}) };
  }) as typeof fetch;
  void opts;
}

describe("HackASprint2026Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHackASprintFetch();
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
    });
  });

  it("renders signed-out content", async () => {
    render(<HackASprintPage />);
    await waitFor(() => {
      expect(screen.getByText(/Hack-a-Sprint 2026/i)).toBeInTheDocument();
    });
  });

  it("loads me state when signed in", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: { uid: "u1", displayName: "Test" },
      loading: false,
    });
    mockHackASprintFetch({ signedIn: true });
    render(<HackASprintPage />);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/submissions"),
        expect.any(Object),
      );
    });
  });
});
