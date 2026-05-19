/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/AuthContext";
import {
  emptyDiscordConnection,
  emptyGithubConnection,
  makeAuthUser,
} from "@/__tests__/app/_shared/game-dashboard-mocks";

jest.mock("@/app/(auth)/profile/_hooks/useGithubConnection", () => ({
  useGithubConnection: () => ({
    ...emptyGithubConnection,
    githubInfo: { login: "admitted-user" },
  }),
}));
jest.mock("@/app/(auth)/profile/_hooks/useDiscordConnection", () => ({
  useDiscordConnection: () => ({
    ...emptyDiscordConnection,
    discordInfo: { username: "admitted#0000" },
  }),
}));

const mockUseAuth = useAuth as jest.Mock;

const admittedApplication = {
  userId: "u1",
  email: "admitted@test.com",
  name: "Admitted Member",
  phone: null,
  cohorts: ["cohort-1"],
  siteId: null,
  status: "admitted" as const,
  isLocal: true,
  wantsToPresent: false,
  mayImmersionRsvped: true,
  cohort1DevEnvConfirmedAt: Date.now(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

function setupSummerCohortFetch(intakeCompleted = false) {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/summer-cohort/apply")) {
      return {
        ok: true,
        json: async () => ({
          application: admittedApplication,
          applicationCounts: { "cohort-1": 40, "cohort-2": 12 },
        }),
      };
    }
    if (url.includes("/api/summer-cohort/intake-survey")) {
      return {
        ok: true,
        json: async () => ({ completed: intakeCompleted }),
      };
    }
    if (url.includes("/api/summer-cohort/submissions/")) {
      return {
        ok: true,
        json: async () => ({
          submissions: [],
          merged: null,
          tryingToWin: null,
        }),
      };
    }
    if (url.includes("/api/summer-cohort/my-score")) {
      return { ok: true, json: async () => ({ score: null }) };
    }
    return { ok: true, json: async () => ({}) };
  }) as typeof fetch;
}

describe("summer-cohort page admitted", () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: { displayName: "Admitted Member" },
      loading: false,
    });
    setupSummerCohortFetch(false);
  });

  it("auto-opens intake survey tab and renders IntakeSurveyForm for incomplete survey", async () => {
    const Page = (await import("@/app/summer-cohort/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText(/Status: Admitted/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Why did you join the program/i),
      ).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/summer-cohort/intake-survey?cohortId=cohort-1"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer /),
        }),
      }),
    );
  });

  it("navigates to intake survey via banner and persists draft in form", async () => {
    setupSummerCohortFetch(true);
    const Page = (await import("@/app/summer-cohort/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText(/Status: Admitted/i)).toBeInTheDocument();
    });

    const cohortInfoTab = screen.getByRole("tab", { name: /cohort info/i });
    await user.click(cohortInfoTab);

    await waitFor(() => {
      expect(screen.queryByText(/Why did you join the program/i)).not.toBeInTheDocument();
      expect(screen.getByText(/You're in! Welcome to Cohort 1/i)).toBeInTheDocument();
    });
  });
});
