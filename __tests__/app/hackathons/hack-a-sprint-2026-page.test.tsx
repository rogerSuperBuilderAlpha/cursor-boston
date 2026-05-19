/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const SAMPLE_SUBMISSION = {
  submissionId: "sub-has-1",
  githubLogin: "other-builder",
  payload: {
    projectRepoUrl: "https://github.com/example/sprint-demo",
    title: "Sprint Demo",
    description: "End-to-end hackathon submission.",
    loomVideoUrl: "https://www.loom.com/share/demo",
    deployedUrl: "https://demo.example.com",
  },
  peerAverage: 4.2,
  peerVoteCount: 5,
  aiScore: 8.5,
  aiRank: 1,
  aiReasoning: "Polished demo with clear narrative.",
  judgeAverage: null,
  rawScore: null,
  myJudgeScore: null,
  myParticipantScore: null,
};

function mockHackASprintFetch(
  opts: {
    signedIn?: boolean;
    phase?: string;
    submissions?: typeof SAMPLE_SUBMISSION[];
    viewer?: Partial<typeof EMPTY_VIEWER>;
    me?: Record<string, unknown>;
    creditCode?: Record<string, unknown>;
    submissionsFail?: boolean;
  } = {},
) {
  const {
    phase = "submissionOpen",
    submissions = [],
    viewer = {},
    me = {
      phase,
      signedUp: true,
      checkedIn: true,
      hasCompletedPeerVoting: false,
      prizeEligible: true,
      highScoreCount: 3,
      requiredHighScores: 3,
      participantEligible: true,
      judgeEligible: false,
      githubLogin: "testuser",
    },
    creditCode = { eligible: false },
    submissionsFail = false,
  } = opts;

  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method || "GET").toUpperCase();

    if (url.includes("/submissions") && !url.includes("participant-score")) {
      if (submissionsFail) {
        return { ok: false, json: async () => ({ error: "fail" }) };
      }
      return {
        ok: true,
        json: async () => ({
          phase,
          viewer: { ...EMPTY_VIEWER, ...viewer },
          submissions,
        }),
      };
    }
    if (url.includes("/me")) {
      return {
        ok: true,
        json: async () => me,
      };
    }
    if (url.includes("/credit-code")) {
      return { ok: true, json: async () => creditCode };
    }
    if (url.includes("/participant-score") && method === "POST") {
      return { ok: true, json: async () => ({ success: true }) };
    }
    if (url.includes("/judge-score") && method === "POST") {
      return { ok: true, json: async () => ({ success: true }) };
    }
    if (url.includes("/credit-email") && method === "POST") {
      return { ok: true, json: async () => ({ ok: true, message: "Sent." }) };
    }
    return { ok: true, json: async () => ({}) };
  }) as typeof fetch;
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

  it("filters gallery submissions by search query", async () => {
    mockHackASprintFetch({
      submissions: [
        SAMPLE_SUBMISSION,
        {
          ...SAMPLE_SUBMISSION,
          submissionId: "sub-has-2",
          githubLogin: "alpha-dev",
          payload: { ...SAMPLE_SUBMISSION.payload, title: "Alpha Project" },
        },
      ],
    });
    const user = userEvent.setup();
    render(<HackASprintPage />);

    expect(await screen.findByText("Sprint Demo")).toBeInTheDocument();
    expect(screen.getByText("Alpha Project")).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(/Search \(title or @github\)/i),
      "alpha-dev",
    );

    await waitFor(() => {
      expect(screen.queryByText("Sprint Demo")).not.toBeInTheDocument();
      expect(screen.getByText("Alpha Project")).toBeInTheDocument();
    });
  });

  it("submits a peer score when voting is open", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: { uid: "u1", displayName: "Test" },
      loading: false,
    });
    mockHackASprintFetch({
      phase: "peerVotingOpen",
      submissions: [SAMPLE_SUBMISSION],
      viewer: {
        canPeerVote: true,
        isSubmitter: true,
      },
      me: {
        phase: "peerVotingOpen",
        signedUp: true,
        checkedIn: true,
        hasCompletedPeerVoting: false,
        prizeEligible: false,
        highScoreCount: 0,
        requiredHighScores: 1,
        participantEligible: true,
        judgeEligible: false,
        githubLogin: "testuser",
      },
    });

    const user = userEvent.setup();
    render(<HackASprintPage />);

    const scoreSelect = (await screen.findAllByRole("combobox"))[0];
    await user.selectOptions(scoreSelect, "9");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/hackathons/showcase/hack-a-sprint-2026/participant-score",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("sub-has-1"),
        }),
      );
    });
  });

  it("submits a judge score when judge-eligible", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: { uid: "u1", displayName: "Test" },
      loading: false,
    });
    mockHackASprintFetch({
      phase: "peerVotingOpen",
      submissions: [SAMPLE_SUBMISSION],
      viewer: { isJudge: true, judgeEligible: true },
      me: {
        phase: "peerVotingOpen",
        signedUp: true,
        checkedIn: true,
        hasCompletedPeerVoting: true,
        prizeEligible: true,
        highScoreCount: 1,
        requiredHighScores: 1,
        participantEligible: true,
        judgeEligible: true,
        githubLogin: "judge-user",
      },
    });

    const user = userEvent.setup();
    render(<HackASprintPage />);

    const judgeSelect = (await screen.findAllByRole("combobox")).find((select) =>
      Array.from(select.querySelectorAll("option")).some(
        (option) => option.textContent === "8",
      ),
    );
    expect(judgeSelect).toBeTruthy();
    await user.selectOptions(judgeSelect!, "8");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/hackathons/showcase/hack-a-sprint-2026/judge-score",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows credit claim section when eligible", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: { uid: "u1", displayName: "Test" },
      loading: false,
    });
    mockHackASprintFetch({
      creditCode: {
        eligible: true,
        creditUrl: "https://cursor.com/credit/abc123",
      },
    });
    render(<HackASprintPage />);

    expect(
      await screen.findByRole("link", { name: /Claim your \$50 Cursor credit/i }),
    ).toHaveAttribute("href", "https://cursor.com/credit/abc123");
  });

  it("sends credit email when user clicks email button", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: { uid: "u1", displayName: "Test" },
      loading: false,
    });
    mockHackASprintFetch({
      creditCode: {
        eligible: true,
        creditUrl: "https://cursor.com/credit/abc123",
      },
    });

    const user = userEvent.setup();
    render(<HackASprintPage />);

    await user.click(
      await screen.findByRole("button", { name: /Email me this link/i }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/hackathons/showcase/hack-a-sprint-2026/credit-email",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows load error when submissions fetch fails", async () => {
    mockHackASprintFetch({ submissionsFail: true });
    render(<HackASprintPage />);

    expect(
      await screen.findByText(/Could not load submissions/i),
    ).toBeInTheDocument();
  });

  it("shows results phase label and community scores when revealed", async () => {
    mockHackASprintFetch({
      phase: "resultsOpen",
      submissions: [
        {
          ...SAMPLE_SUBMISSION,
          peerAverage: 8.1,
          rawScore: 7.5,
          judgeAverage: 8.0,
        },
      ],
      viewer: {
        peerScoresRevealed: true,
        canPeerVote: true,
        hasCompletedPeerVoting: true,
      },
      me: {
        phase: "resultsOpen",
        signedUp: true,
        checkedIn: true,
        hasCompletedPeerVoting: true,
        prizeEligible: true,
        highScoreCount: 1,
        requiredHighScores: 1,
        participantEligible: true,
        judgeEligible: false,
        githubLogin: "testuser",
      },
    });
    render(<HackASprintPage />);

    expect(
      await screen.findByText(/Current phase: Final results/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Peer avg/i)).toBeInTheDocument();
    expect(screen.getByText(/8.10/)).toBeInTheDocument();
  });
});
