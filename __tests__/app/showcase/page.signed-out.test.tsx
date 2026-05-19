/* eslint-disable @next/next/no-img-element -- next/image mocked as img for RTL */
/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

jest.mock("@/content/showcase.json", () => ({
  projects: [
    {
      id: "proj-1",
      name: "Demo Project",
      description: "A community project",
      image: "/showcase/proj-1.png",
      categories: ["AI"],
      contact: {},
      submittedBy: "Member",
      submittedDate: "2026-03-10",
    },
  ],
}));

const mockUseAuth = useAuth as jest.Mock;

describe("showcase page signed out", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();
      if (url.includes("/api/showcase/vote") && method === "GET") {
        return {
          ok: true,
          json: async () => ({
            votes: { "proj-1": { upCount: 2, downCount: 0 } },
            userVotes: {},
          }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }) as typeof fetch;
  });

  it("renders gallery and sign-in hints without auth headers on vote fetch", async () => {
    const Page = (await import("@/app/showcase/page")).default;
    render(<Page />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^Showcase$/i })).toBeInTheDocument();
      expect(screen.getByText("Demo Project")).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/showcase/vote",
      expect.objectContaining({ headers: {} }),
    );
    await waitFor(() => {
      expect(screen.getAllByTitle("Sign in to vote").length).toBeGreaterThan(0);
    });
  });
});
