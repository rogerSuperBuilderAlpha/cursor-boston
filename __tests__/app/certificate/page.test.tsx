/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;

const contributorCertificate = {
  id: "cert-1",
  userId: "u1",
  displayName: "Contributor",
  githubLogin: "contrib",
  issuedAt: "2026-05-01T00:00:00.000Z",
  certName: "Open Source Contributor",
  certUrl: "https://example.com/cert",
  kind: "contributor",
  pullRequestsCount: 10,
};

describe("certificate page", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("u1"),
      userProfile: { github: { login: "contrib" } },
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/certificate/mine") {
        return { ok: true, json: async () => ({ certificates: [] }) };
      }
      if (url.startsWith("/api/profile/data")) {
        return {
          ok: true,
          json: async () => ({ stats: { pullRequestsCount: 10 } }),
        };
      }
      if (url === "/api/certificate/claim" && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            certificate: contributorCertificate,
            linkedInAddToProfileUrl: "https://linkedin.example/add",
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;
  });

  it("auto-claims and can claim contributor certificate", async () => {
    const Page = (await import("@/app/certificate/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(screen.getByText(/LinkedIn Certificates/i)).toBeInTheDocument();
      expect(screen.getByText(/Open Source Contributor/i)).toBeInTheDocument();
    });

    const claimButton = screen.queryByRole("button", {
      name: /Claim Contributor Certificate/i,
    });
    if (claimButton) {
      fireEvent.click(claimButton);
    }

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/certificate/claim",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
