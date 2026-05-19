/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";

const mockUseAuth = useAuth as jest.Mock;

describe("summer-cohort page signed out", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
    });
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })) as typeof fetch;
  });

  it("prompts visitors to create an account without calling apply API", async () => {
    const Page = (await import("@/app/summer-cohort/page")).default;
    render(<Page />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Create an account to apply/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Create account/i }),
      ).toHaveAttribute("href", expect.stringContaining("/signup"));
      expect(
        screen.getByRole("link", { name: /Already have an account\? Sign in/i }),
      ).toHaveAttribute("href", expect.stringContaining("/login"));
    });
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/summer-cohort/apply"),
      expect.anything(),
    );
  });
});
