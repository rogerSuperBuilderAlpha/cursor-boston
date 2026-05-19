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

const admittedApplication = {
  userId: "u1",
  email: "u1@test.com",
  name: "Applicant",
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

describe("summer-cohort page admitted", () => {
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
            application: admittedApplication,
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

  it("renders admitted status and intake path", async () => {
    const Page = (await import("@/app/summer-cohort/page")).default;
    render(<Page />);
    await waitFor(
      () => {
        const text = document.body.textContent ?? "";
        expect(text).toMatch(/admitted/i);
        expect(text.length).toBeGreaterThan(200);
      },
      { timeout: 15000 },
    );
  }, 20000);
});
