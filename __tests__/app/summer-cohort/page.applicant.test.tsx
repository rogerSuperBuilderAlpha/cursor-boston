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
  useGithubConnection: () => emptyGithubConnection,
}));
jest.mock("@/app/(auth)/profile/_hooks/useDiscordConnection", () => ({
  useDiscordConnection: () => emptyDiscordConnection,
}));

const mockUseAuth = useAuth as jest.Mock;

const pendingApplication = {
  userId: "u1",
  email: "applicant@test.com",
  name: "Pending Applicant",
  phone: "555-0100",
  cohorts: ["cohort-2"],
  siteId: null,
  status: "pending" as const,
  isLocal: false,
  wantsToPresent: true,
  mayImmersionRsvped: false,
  cohort1DevEnvConfirmedAt: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("summer-cohort page applicant", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: { displayName: "Pending Applicant" },
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();
      if (url.includes("/api/summer-cohort/apply") && method === "GET") {
        return {
          ok: true,
          json: async () => ({
            application: pendingApplication,
            applicationCounts: { "cohort-1": 30, "cohort-2": 15 },
          }),
        };
      }
      if (url.includes("/api/summer-cohort/apply") && method === "POST") {
        return {
          ok: true,
          json: async () => ({
            application: { ...pendingApplication, name: "Updated Name" },
          }),
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
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;
  });

  it("renders pending status, application counter, and edit-details flow", async () => {
    const Page = (await import("@/app/summer-cohort/page")).default;
    const user = userEvent.setup();
    render(<Page />);

    expect(await screen.findByText(/Status: Pending/i)).toBeInTheDocument();
    expect(screen.getByText(/Applications so far/i)).toBeInTheDocument();
    expect(screen.getByText(/Want to do both/i)).toBeInTheDocument();

    const editBtn = await screen.findByRole("button", { name: /^Edit$/i });
    await user.click(editBtn);

    await waitFor(() => {
      expect(screen.getByLabelText(/^Name$/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/^Name$/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Name");

    const saveBtn = screen.getByRole("button", { name: /save updates/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/summer-cohort/apply",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
