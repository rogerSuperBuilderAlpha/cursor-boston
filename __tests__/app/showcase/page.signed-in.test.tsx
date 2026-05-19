/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;

describe("showcase page signed in", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/showcase/vote") && !url.includes("POST")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            votes: { "proj-1": { upCount: 3, downCount: 1 } },
            userVotes: {},
          }),
        };
      }
      if (url.includes("/api/showcase/submission")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            submissions: [],
            pending: [],
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
  });

  it("loads vote data for signed-in user", async () => {
    const Page = (await import("@/app/showcase/page")).default;
    const { container } = render(<Page />);
    await waitFor(
      () => {
        expect(container.textContent?.length ?? 0).toBeGreaterThan(100);
      },
      { timeout: 4000 },
    );
  });
});
