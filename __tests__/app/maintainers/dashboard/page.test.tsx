/**
 * @jest-environment jsdom
 */

const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
    back: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/maintainers/dashboard",
  useParams: () => ({}),
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;

const queuePayload = {
  notApprovedCount: 2,
  notCommentedCount: 1,
  notApproved: [
    { number: 101, title: "Feature A", htmlUrl: "https://github.com/pr/101", authorLogin: "dev1" },
  ],
  notCommented: [
    { number: 102, title: "Feature B", htmlUrl: "https://github.com/pr/102", authorLogin: "dev2" },
  ],
  approvedNotMerged: [
    { number: 99, title: "Ready merge", htmlUrl: "https://github.com/pr/99", authorLogin: "dev3" },
  ],
  githubConfigured: false,
};

describe("Maintainer dashboard page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("redirects signed-out users to login", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    const Page = (await import("@/app/maintainers/dashboard/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/login?redirect=/maintainers/dashboard");
    });
  });

  it("redirects ineligible maintainers to apply", async () => {
    mockUseAuth.mockReturnValue({ user: makeAuthUser("m1"), loading: false });
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ eligible: false }),
    });

    const Page = (await import("@/app/maintainers/dashboard/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/maintainers/apply");
    });
  });

  it("renders review queue and approved tab", async () => {
    mockUseAuth.mockReturnValue({ user: makeAuthUser("m1"), loading: false });
    (global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/maintainers/status")) {
        return { ok: true, json: async () => ({ eligible: true }) };
      }
      if (url.includes("/api/maintainers/review-queue")) {
        return { ok: true, json: async () => queuePayload };
      }
      return { ok: false, json: async () => ({}) };
    });

    const Page = (await import("@/app/maintainers/dashboard/page")).default;
    render(<Page />);

    expect(await screen.findByText(/Maintainer dashboard/i)).toBeInTheDocument();
    expect(await screen.findByText(/GITHUB_TOKEN/i)).toBeInTheDocument();
    expect(screen.getAllByText(String(queuePayload.notApprovedCount)).length).toBeGreaterThan(0);
    expect(screen.getByText(/#101/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Approved, not merged/i }));
    expect(await screen.findByText(/Ready merge/i)).toBeInTheDocument();
  });

  it("shows error state when status fetch fails", async () => {
    mockUseAuth.mockReturnValue({ user: makeAuthUser("m1"), loading: false });
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    const Page = (await import("@/app/maintainers/dashboard/page")).default;
    render(<Page />);

    expect(await screen.findByText(/Could not load dashboard/i)).toBeInTheDocument();
  });
});
