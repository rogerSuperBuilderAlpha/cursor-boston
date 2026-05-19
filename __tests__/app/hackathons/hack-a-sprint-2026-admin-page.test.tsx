/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: makeAuthUser(),
    userProfile: { isAdmin: true },
    loading: false,
  });
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("admin-dashboard")) {
      return {
        ok: true,
        json: async () => ({
          phase: "submissionOpen",
          submissions: [],
          checkedInCount: 0,
          signupCount: 0,
        }),
      };
    }
    if (url.includes("/signup")) {
      return {
        ok: true,
        json: async () => ({
          eventId: "hack-a-sprint-2026",
          totalCount: 0,
          entries: [],
          creditTopN: 10,
          me: null,
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  }) as typeof fetch;
});

describe("HackASprint2026 admin page", () => {
  it("renders admin console for maintainer", async () => {
    const Page = (await import("@/app/hackathons/hack-a-sprint-2026/admin/page")).default;
    const { container } = render(<Page />);
    await waitFor(
      () => {
        expect(container.textContent?.length ?? 0).toBeGreaterThan(50);
      },
      { timeout: 4000 },
    );
  });
});
