/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;

function mockAdminFetch() {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("admin-dashboard")) {
      return {
        ok: true,
        json: async () => ({
          phase: "submissionOpen",
          totalSubmissions: 0,
          totalSignups: 2,
          totalVoters: 0,
          judgeUids: [],
          judgeProgress: [],
          submissions: [],
        }),
      };
    }
    if (url.includes("/signup")) {
      return {
        ok: true,
        json: async () => ({
          eventId: "hack-a-sprint-2026",
          totalCount: 2,
          websiteSignupCount: 2,
          entries: [
            {
              rank: 1,
              userId: "u1",
              displayName: "Alice",
              githubLogin: "alice",
              mergedPrCount: 2,
              signedUpAt: "2026-05-20T10:00:00.000Z",
              creditEligible: true,
              status: "confirmed",
              checkedIn: true,
            },
          ],
          creditTopN: 10,
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  }) as typeof fetch;
}

describe("Hack-a-Sprint 2026 admin page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminFetch();
  });

  it("asks signed-out visitors to sign in", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
    });
    const Page = (await import("@/app/hackathons/hack-a-sprint-2026/admin/page"))
      .default;
    render(<Page />);
    expect(
      await screen.findByText(/Sign in to access admin dashboard/i),
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("renders live dashboard for maintainers", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      userProfile: { isAdmin: true },
      loading: false,
    });
    const Page = (await import("@/app/hackathons/hack-a-sprint-2026/admin/page"))
      .default;
    render(<Page />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Live Event Dashboard/i }),
      ).toBeInTheDocument();
      expect(screen.getByText("Check-In (1)")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("admin-dashboard"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer /),
        }),
      }),
    );
  });
});
