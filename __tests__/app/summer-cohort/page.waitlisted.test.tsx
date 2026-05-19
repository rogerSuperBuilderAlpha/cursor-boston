/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import {
  emptyDiscordConnection,
  emptyGithubConnection,
  makeAuthUser,
} from "@/__tests__/app/_shared/game-dashboard-mocks";

jest.mock("@/app/(auth)/profile/_hooks/useGithubConnection", () => ({
  useGithubConnection: () => emptyGithubConnection,
}));
jest.mock("@/app/(auth)/profile/_hooks/useDiscordConnection", () => ({
  useDiscordConnection: () => emptyDiscordConnection,
}));

const mockUseAuth = useAuth as jest.Mock;

const waitlistedApplication = {
  userId: "u1",
  email: "u1@test.com",
  name: "Applicant",
  phone: null,
  cohorts: ["cohort-1"],
  siteId: null,
  status: "waitlist" as const,
  isLocal: true,
  wantsToPresent: false,
  mayImmersionRsvped: false,
  cohort1DevEnvConfirmedAt: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("summer-cohort page waitlisted", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: { displayName: "Applicant" },
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/summer-cohort/apply")) {
        return {
          ok: true,
          json: async () => ({
            application: waitlistedApplication,
            applicationCounts: { "cohort-1": 12, "cohort-2": 8 },
          }),
        };
      }
      if (url.includes("/api/summer-cohort/intake-survey")) {
        return {
          ok: true,
          json: async () => ({ completed: false }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;
  });

  it("renders waitlist status and program context", async () => {
    const Page = (await import("@/app/summer-cohort/page")).default;
    render(<Page />);
    await waitFor(
      () => {
        expect(screen.getByText(/Status: Waitlist/i)).toBeInTheDocument();
        expect(
          screen.getByText(/You're on the waitlist for/i),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/We'll let you know by email if a spot opens up/i),
        ).toBeInTheDocument();
      },
      { timeout: 15000 },
    );
  }, 20000);
});
