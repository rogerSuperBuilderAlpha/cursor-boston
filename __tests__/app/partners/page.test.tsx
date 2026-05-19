/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;

describe("partners page", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("partner"),
      loading: false,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        application: {
          userId: "partner",
          email: "partner@test.com",
          contactName: "Partner Lead",
          phone: "555-0100",
          companyName: "Acme AI",
          companyWebsite: "https://example.com",
          contactRole: "Founder",
          rolesHiring: "Frontend engineers",
          notes: "Looking for builders",
          engineerExpectations: {},
          engineerRequirements: "React",
          status: "approved",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      }),
    }) as typeof fetch;
  });

  it("renders approved partner status", async () => {
    const Page = (await import("@/app/partners/page")).default;
    render(<Page />);

    await waitFor(
      () => {
        expect(screen.getByText(/approved Cursor Boston hiring partner/i)).toBeInTheDocument();
        expect(screen.getByDisplayValue(/Acme AI/i)).toBeInTheDocument();
      },
      { timeout: 15000 },
    );
  }, 20000);
});
