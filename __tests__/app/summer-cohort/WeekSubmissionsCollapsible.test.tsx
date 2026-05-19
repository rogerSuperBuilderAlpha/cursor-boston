/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WeekSubmissionsCollapsible } from "@/app/summer-cohort/_components/WeekSubmissionsCollapsible";
import { SUMMER_COHORT_C1_VOTE_WEEKS } from "@/lib/summer-cohort";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;
const week = SUMMER_COHORT_C1_VOTE_WEEKS[0]!;

const defaultProps = {
  week,
  tabId: "c1w1",
  cohortId: "cohort-1" as const,
  currentUserGithubHandle: "member-one",
  currentUserDisplayName: "Member One",
  currentUserPhotoUrl: "https://example.com/photo.jpg",
  onSwitchToMyInfo: jest.fn(),
};

function setupFetch(overrides?: {
  submissions?: unknown[];
  voteCounts?: Record<string, number>;
  myVotes?: string[];
  myScore?: Record<string, unknown> | null;
}) {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method || "GET").toUpperCase();
    if (url.includes("/api/summer-cohort/submissions/")) {
      return {
        ok: true,
        json: async () => ({
          weekId: "c1w1",
          branch: week.submissionBranch,
          path: "submissions/cohort-1/week-1",
          merged: 2,
          tryingToWin: 1,
          submissions: overrides?.submissions ?? [
            {
              githubHandle: "member-one",
              repoUrl: "https://github.com/member-one/repo",
              loomUrl: "https://loom.com/share/abc",
              liveUrl: "https://live.example.com",
              pitch: "Ship it",
              competeForWin: true,
              allFieldsPresent: true,
              displayName: "Member One",
              photoUrl: null,
            },
            {
              githubHandle: "rival-dev",
              repoUrl: "https://github.com/rival-dev/repo",
              loomUrl: "https://loom.com/share/def",
              liveUrl: "https://rival.example.com",
              pitch: "Also shipping",
              competeForWin: true,
              allFieldsPresent: true,
              displayName: "Rival Dev",
              photoUrl: "https://example.com/rival.jpg",
            },
          ],
        }),
      };
    }
    if (url.includes("/api/summer-cohort/votes") && method === "GET") {
      return {
        ok: true,
        json: async () => ({
          weekId: "c1w1",
          counts: overrides?.voteCounts ?? { "rival-dev": 3 },
          myVotes: overrides?.myVotes ?? [],
          authenticated: true,
        }),
      };
    }
    if (url.includes("/api/summer-cohort/votes") && method === "POST") {
      return {
        ok: true,
        json: async () => ({ voted: true, count: 4 }),
      };
    }
    if (url.includes("/api/summer-cohort/my-score/")) {
      if (overrides?.myScore === null) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      return {
        ok: true,
        json: async () =>
          overrides?.myScore ?? {
            weekId: "c1w1",
            githubHandle: "member-one",
            score: 8,
            rationale: "Strong demo and clear pitch.",
            model: "claude-test",
            scoredAt: "2026-05-10T12:00:00.000Z",
          },
      };
    }
    return { ok: true, json: async () => ({}) };
  }) as typeof fetch;
}

describe("WeekSubmissionsCollapsible", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("uid-member"),
      loading: false,
    });
    setupFetch();
  });

  it("renders merged counts and expands merge instructions", async () => {
    const user = userEvent.setup();
    render(<WeekSubmissionsCollapsible {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /2 merged · 1 trying to win/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { expanded: false }));

    expect(screen.getByText(/How to get on this list/i)).toBeInTheDocument();
    expect(screen.getByText(/member-one\/your-week-/)).toBeInTheDocument();
  });

  it("toggles votes and shows AI judge feedback for the signed-in submitter", async () => {
    const user = userEvent.setup();
    render(<WeekSubmissionsCollapsible {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /2 merged · 1 trying to win/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { expanded: false }));

    await waitFor(() => {
      expect(screen.getByText(/Your AI judge feedback/i)).toBeInTheDocument();
      expect(screen.getByText(/Strong demo and clear pitch/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Upvote rival-dev/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/summer-cohort/votes",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            weekId: "c1w1",
            submitterHandle: "rival-dev",
            cohortId: "cohort-1",
          }),
        }),
      );
    });
  });

  it("prompts to connect GitHub when the handle is missing", async () => {
    const onSwitch = jest.fn();
    render(
      <WeekSubmissionsCollapsible
        {...defaultProps}
        currentUserGithubHandle={null}
        onSwitchToMyInfo={onSwitch}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Connect GitHub/i })).toBeInTheDocument();
    });

    await userEvent.setup().click(screen.getByRole("button", { name: /Connect GitHub/i }));
    expect(onSwitch).toHaveBeenCalled();
  });

  it("observer mode hides voting controls but still lists submissions", async () => {
    const user = userEvent.setup();
    render(<WeekSubmissionsCollapsible {...defaultProps} observer />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Submissions — observing/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { expanded: false }));

    await waitFor(() => {
      expect(screen.getByText("Rival Dev")).toBeInTheDocument();
      expect(screen.queryByText(/How to get on this list/i)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Upvote rival-dev/i }),
      ).not.toBeInTheDocument();
    });
  });
});
