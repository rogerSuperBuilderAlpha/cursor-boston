/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;

describe("admin moderation page", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("admin"),
      userProfile: { isAdmin: true },
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/community/moderate") && init?.method === "POST") {
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url.startsWith("/api/community/moderate")) {
        return {
          ok: true,
          json: async () => ({
            reports: [
              {
                reportId: "report-1",
                reporterUid: "u1",
                reporterDisplayName: "Reporter",
                targetMessageId: "msg-1",
                targetAuthorId: "u2",
                reason: "spam",
                notes: "Looks automated",
                status: "open",
                action: null,
                actionedBy: null,
                createdAt: "2026-05-01T00:00:00.000Z",
                actionedAt: null,
              },
            ],
            nextCursor: null,
            hasMore: false,
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;
  });

  it("renders reports and dismisses one", async () => {
    const Page = (await import("@/app/admin/moderation/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText(/Moderation queue/i)).toBeInTheDocument();
      expect(screen.getByText(/Looks automated/i)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /Dismiss/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/community/moderate",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
