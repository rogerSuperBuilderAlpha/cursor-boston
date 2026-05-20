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

  it("shows loading spinner while auth is loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: true,
    });
    render(<HackASprintPage />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it("shows fallback error UI when initial data load fails entirely", async () => {
    mockHackASprintFetch({ submissionsFail: true });
    render(<HackASprintPage />);
    expect(
      await screen.findByText(/Could not load submissions/i),
    ).toBeInTheDocument();
    // The fallback error UI links back to /hackathons
    expect(
      screen.getByRole("link", { name: /Hackathons/i }),
    ).toHaveAttribute("href", "/hackathons");
  });

  it("renders empty submissions message when none exist", async () => {
    mockHackASprintFetch({ submissions: [] });
    render(<HackASprintPage />);
    expect(
      await screen.findByText(/No merged submissions yet/i),
    ).toBeInTheDocument();
  });

  it("changes sort key via the Sort by dropdown", async () => {
    mockHackASprintFetch({
      submissions: [
        { ...SAMPLE_SUBMISSION, submissionId: "s1", payload: { ...SAMPLE_SUBMISSION.payload, title: "Beta" }, githubLogin: "zebra", aiScore: 5, peerAverage: 6 },
        { ...SAMPLE_SUBMISSION, submissionId: "s2", payload: { ...SAMPLE_SUBMISSION.payload, title: "Alpha" }, githubLogin: "apple", aiScore: 9, peerAverage: 4 },
      ],
    });
    const user = userEvent.setup();
    render(<HackASprintPage />);
    await screen.findByText("Beta");

    const sortSelect = screen.getByLabelText(/Sort by/i);
    // Cycle through every sort key to exercise compareSubmissionRows branches
    await user.selectOptions(sortSelect, "github");
    await user.selectOptions(sortSelect, "aiScore");
    await user.selectOptions(sortSelect, "peerAvg");
    await user.selectOptions(sortSelect, "title");

    // Toggle ascending → descending
    const dirButton = screen.getByRole("button", { name: /Ascending/i });
    await user.click(dirButton);
    expect(
      screen.getByRole("button", { name: /Descending/i }),
    ).toBeInTheDocument();
  });

  it("handles null aiScore / peerAverage when sorting", async () => {
    mockHackASprintFetch({
      submissions: [
        { ...SAMPLE_SUBMISSION, submissionId: "s1", payload: { ...SAMPLE_SUBMISSION.payload, title: "Beta" }, githubLogin: "zebra", aiScore: null, peerAverage: null },
        { ...SAMPLE_SUBMISSION, submissionId: "s2", payload: { ...SAMPLE_SUBMISSION.payload, title: "Alpha" }, githubLogin: "apple", aiScore: 9, peerAverage: 4 },
        { ...SAMPLE_SUBMISSION, submissionId: "s3", payload: { ...SAMPLE_SUBMISSION.payload, title: "Gamma" }, githubLogin: "mike", aiScore: 7, peerAverage: 5 },
      ],
    });
    const user = userEvent.setup();
    render(<HackASprintPage />);
    await screen.findByText("Beta");

    const sortSelect = screen.getByLabelText(/Sort by/i);
    await user.selectOptions(sortSelect, "aiScore");
    await user.selectOptions(sortSelect, "peerAvg");
    // Both should render (null values sort to end)
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("handles failure when /me endpoint returns non-ok", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: { uid: "u1", displayName: "Test" },
      loading: false,
    });
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
        return { ok: false, json: async () => ({ error: "no me" }) };
      }
      if (url.includes("/credit-code")) {
        return { ok: true, json: async () => ({ eligible: false }) };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;

    render(<HackASprintPage />);
    expect(
      await screen.findByText(/Could not load eligibility/i),
    ).toBeInTheDocument();
  });

  it("handles credit-code endpoint failure gracefully", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: { uid: "u1", displayName: "Test" },
      loading: false,
    });
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
            prizeEligible: false,
            highScoreCount: 0,
            requiredHighScores: 1,
            participantEligible: true,
            judgeEligible: false,
            githubLogin: "testuser",
          }),
        };
      }
      if (url.includes("/credit-code")) {
        return { ok: false, json: async () => ({ error: "denied" }) };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;

    render(<HackASprintPage />);
    await waitFor(() => {
      expect(
        screen.queryByRole("link", { name: /Claim your \$50 Cursor credit/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("surfaces error when participant-score POST fails", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: { uid: "u1", displayName: "Test" },
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();
      if (url.includes("/participant-score") && method === "POST") {
        return { ok: false, json: async () => ({ error: "bad score" }) };
      }
      if (url.includes("/submissions")) {
        return {
          ok: true,
          json: async () => ({
            phase: "peerVotingOpen",
            viewer: { ...EMPTY_VIEWER, canPeerVote: true, isSubmitter: true },
            submissions: [SAMPLE_SUBMISSION],
          }),
        };
      }
      if (url.includes("/me")) {
        return {
          ok: true,
          json: async () => ({
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
          }),
        };
      }
      if (url.includes("/credit-code")) {
        return { ok: true, json: async () => ({ eligible: false }) };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;

    const user = userEvent.setup();
    render(<HackASprintPage />);
    const scoreSelect = (await screen.findAllByRole("combobox"))[0];
    await user.selectOptions(scoreSelect, "9");

    expect(await screen.findByText(/bad score/i)).toBeInTheDocument();
  });

  it("surfaces error when judge-score POST fails", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: { uid: "u1", displayName: "Test" },
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();
      if (url.includes("/judge-score") && method === "POST") {
        return { ok: false, json: async () => ({ error: "judge oops" }) };
      }
      if (url.includes("/submissions")) {
        return {
          ok: true,
          json: async () => ({
            phase: "peerVotingOpen",
            viewer: { ...EMPTY_VIEWER, isJudge: true, judgeEligible: true },
            submissions: [SAMPLE_SUBMISSION],
          }),
        };
      }
      if (url.includes("/me")) {
        return {
          ok: true,
          json: async () => ({
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
          }),
        };
      }
      if (url.includes("/credit-code")) {
        return { ok: true, json: async () => ({ eligible: false }) };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;

    const user = userEvent.setup();
    render(<HackASprintPage />);

    const judgeSelect = (await screen.findAllByRole("combobox")).find((select) =>
      Array.from(select.querySelectorAll("option")).some(
        (option) => option.textContent === "8",
      ),
    );
    await user.selectOptions(judgeSelect!, "8");

    expect(await screen.findByText(/judge oops/i)).toBeInTheDocument();
  });

  it("surfaces error when credit-email POST fails", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: { uid: "u1", displayName: "Test" },
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();
      if (url.includes("/credit-email") && method === "POST") {
        return { ok: false, json: async () => ({ error: "email failed" }) };
      }
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
            prizeEligible: false,
            highScoreCount: 0,
            requiredHighScores: 1,
            participantEligible: true,
            judgeEligible: false,
            githubLogin: "testuser",
          }),
        };
      }
      if (url.includes("/credit-code")) {
        return {
          ok: true,
          json: async () => ({
            eligible: true,
            creditUrl: "https://cursor.com/credit/xyz",
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;

    const user = userEvent.setup();
    render(<HackASprintPage />);

    await user.click(
      await screen.findByRole("button", { name: /Email me this link/i }),
    );

    expect(await screen.findByText(/email failed/i)).toBeInTheDocument();
  });

  it("shows alreadySent message when credit-email returns alreadySent flag", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: { uid: "u1", displayName: "Test" },
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();
      if (url.includes("/credit-email") && method === "POST") {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            alreadySent: true,
            message: "Already sent last week",
          }),
        };
      }
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
            prizeEligible: false,
            highScoreCount: 0,
            requiredHighScores: 1,
            participantEligible: true,
            judgeEligible: false,
            githubLogin: "testuser",
          }),
        };
      }
      if (url.includes("/credit-code")) {
        return {
          ok: true,
          json: async () => ({
            eligible: true,
            creditUrl: "https://cursor.com/credit/xyz",
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;

    const user = userEvent.setup();
    render(<HackASprintPage />);

    await user.click(
      await screen.findByRole("button", { name: /Email me this link/i }),
    );

    expect(await screen.findByText(/Already sent last week/i)).toBeInTheDocument();
  });

  it("renders participant queue mode with own + unscored + scored sections", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: { uid: "u1", displayName: "Test" },
      loading: false,
    });
    const ownSub = {
      ...SAMPLE_SUBMISSION,
      submissionId: "own-1",
      githubLogin: "testuser",
      payload: { ...SAMPLE_SUBMISSION.payload, title: "My Own Project" },
    };
    const unscored = {
      ...SAMPLE_SUBMISSION,
      submissionId: "unscored-1",
      githubLogin: "alice",
      payload: { ...SAMPLE_SUBMISSION.payload, title: "Unscored One" },
      myParticipantScore: null,
    };
    const scored = {
      ...SAMPLE_SUBMISSION,
      submissionId: "scored-1",
      githubLogin: "bob",
      payload: { ...SAMPLE_SUBMISSION.payload, title: "Scored One" },
      myParticipantScore: 7,
    };
    mockHackASprintFetch({
      phase: "peerVotingOpen",
      submissions: [ownSub, unscored, scored],
      viewer: {
        canPeerVote: true,
        isSubmitter: true,
        myParticipantScores: { "scored-1": 7 },
      },
      me: {
        phase: "peerVotingOpen",
        signedUp: true,
        checkedIn: true,
        hasCompletedPeerVoting: false,
        prizeEligible: false,
        highScoreCount: 0,
        requiredHighScores: 6,
        participantEligible: true,
        judgeEligible: false,
        githubLogin: "testuser",
      },
    });
    render(<HackASprintPage />);
    expect(await screen.findByText(/Your submission/i)).toBeInTheDocument();
    expect(screen.getByText("My Own Project")).toBeInTheDocument();
    expect(screen.getByText(/Projects to score next/i)).toBeInTheDocument();
    expect(screen.getByText("Unscored One")).toBeInTheDocument();
    // The scored details summary shows count
    expect(screen.getByText(/Change a score you already gave/i)).toBeInTheDocument();
  });

  it("renders empty-queue help text when filter excludes everything", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: { uid: "u1", displayName: "Test" },
      loading: false,
    });
    mockHackASprintFetch({
      phase: "peerVotingOpen",
      submissions: [
        {
          ...SAMPLE_SUBMISSION,
          submissionId: "sub-x",
          githubLogin: "alice",
          payload: { ...SAMPLE_SUBMISSION.payload, title: "Alice Project" },
          myParticipantScore: null,
        },
      ],
      viewer: {
        canPeerVote: true,
        isSubmitter: true,
        myParticipantScores: {},
      },
      me: {
        phase: "peerVotingOpen",
        signedUp: true,
        checkedIn: true,
        hasCompletedPeerVoting: false,
        prizeEligible: false,
        highScoreCount: 0,
        requiredHighScores: 6,
        participantEligible: true,
        judgeEligible: false,
        githubLogin: "no-own-project",
      },
    });
    const user = userEvent.setup();
    render(<HackASprintPage />);

    await screen.findByText("Alice Project");
    await user.type(
      screen.getByLabelText(/Search \(title or @github\)/i),
      "nomatch-xyz",
    );
    expect(
      await screen.findByText(/No submissions match your filter/i),
    ).toBeInTheDocument();
  });

  it("renders results phase awards messaging when peer scores revealed", async () => {
    mockHackASprintFetch({
      phase: "resultsOpen",
      submissions: [
        {
          ...SAMPLE_SUBMISSION,
          peerAverage: 8.1,
          rawScore: 7.5,
          judgeAverage: 8.0,
          aiRank: 1,
          aiScore: 9,
        },
      ],
      viewer: {
        peerScoresRevealed: true,
        hasCompletedPeerVoting: true,
      },
    });
    render(<HackASprintPage />);

    expect(
      await screen.findByText(/Official order/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Judges winners/i)).toBeInTheDocument();
    expect(screen.getAllByText(/AI rank/i).length).toBeGreaterThan(0);
  });

  it("renders submission card with missing repo url and walkthrough", async () => {
    mockHackASprintFetch({
      submissions: [
        {
          ...SAMPLE_SUBMISSION,
          submissionId: "missing-data",
          payload: {
            projectRepoUrl: "",
            title: "No Repo Here",
            description: "",
            loomVideoUrl: "",
            deployedUrl: "",
          },
          aiScore: null,
          aiRank: null,
          aiReasoning: null,
        },
      ],
    });
    render(<HackASprintPage />);
    expect(await screen.findByText("No Repo Here")).toBeInTheDocument();
    expect(screen.getByText(/No repo URL/i)).toBeInTheDocument();
    expect(screen.getByText(/No walkthrough yet/i)).toBeInTheDocument();
    expect(
      screen.getByText(/No description in submission yet/i),
    ).toBeInTheDocument();
  });

  it("re-fetches on visibilitychange and stops polling when hidden", async () => {
    mockHackASprintFetch();
    render(<HackASprintPage />);
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/submissions"),
        expect.any(Object),
      ),
    );
    const initialCallCount = (global.fetch as jest.Mock).mock.calls.length;

    // Simulate going hidden
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    // Simulate going visible again — triggers another loadAll
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => {
      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(
        initialCallCount,
      );
    });
  });

  it("shows AI reasoning block when aiScore present", async () => {
    mockHackASprintFetch({
      submissions: [
        {
          ...SAMPLE_SUBMISSION,
          aiScore: 8.5,
          aiRank: 1,
          aiReasoning: "Strong technical execution",
        },
      ],
    });
    render(<HackASprintPage />);
    expect(
      await screen.findByText(/Strong technical execution/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Why this AI score/i)).toBeInTheDocument();
  });

  it("shows AI block with placeholder when aiReasoning is missing", async () => {
    mockHackASprintFetch({
      submissions: [
        {
          ...SAMPLE_SUBMISSION,
          aiScore: 6.0,
          aiRank: 2,
          aiReasoning: null,
        },
      ],
    });
    render(<HackASprintPage />);
    expect(
      await screen.findByText(/No written review stored yet/i),
    ).toBeInTheDocument();
  });
});
