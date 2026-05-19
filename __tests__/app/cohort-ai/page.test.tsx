/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;

describe("CohortAiPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("shows loading state while auth resolves", async () => {
    mockUseAuth.mockReturnValue({ user: null, userProfile: null, loading: true });
    const Page = (await import("@/app/cohort-ai/page")).default;
    render(<Page />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it("prompts signed-out users to sign in", async () => {
    mockUseAuth.mockReturnValue({ user: null, userProfile: null, loading: false });
    const Page = (await import("@/app/cohort-ai/page")).default;
    render(<Page />);
    expect(screen.getByText(/Cohort assistant/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login?redirect=/cohort-ai",
    );
  });

  it("shows Ludwitt connect CTA when not linked", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("cohort-u"),
      userProfile: { displayName: "Member" },
      loading: false,
    });
    const Page = (await import("@/app/cohort-ai/page")).default;
    render(<Page />);
    expect(screen.getByText(/Sign in with Ludwitt to use this/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sign in with Ludwitt/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/api/ludwitt/authorize"),
    );
  });

  it("submits a prompt and renders assistant reply with credits", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("cohort-u"),
      userProfile: { ludwitt: { sub: "lud-1" } },
      loading: false,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) =>
          name === "x-ludwitt-credits"
            ? JSON.stringify({ chargedCostCents: 12, newBalance: 500 })
            : null,
      },
      json: async () => ({
        content: [{ type: "text", text: "Here is cohort advice." }],
      }),
    });

    const Page = (await import("@/app/cohort-ai/page")).default;
    render(<Page />);

    fireEvent.change(screen.getByPlaceholderText(/Ask anything/i), {
      target: { value: "How do weekly submissions work?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Ask$/i }));

    await waitFor(() => {
      expect(screen.getByText("How do weekly submissions work?")).toBeInTheDocument();
      expect(screen.getByText("Here is cohort advice.")).toBeInTheDocument();
      expect(screen.getByText(/cost:/i)).toBeInTheDocument();
    });
  });

  it("handles out-of-credits response", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("cohort-u"),
      userProfile: { ludwitt: { sub: "lud-1" } },
      loading: false,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({}),
    });

    const Page = (await import("@/app/cohort-ai/page")).default;
    render(<Page />);

    fireEvent.change(screen.getByPlaceholderText(/Ask anything/i), {
      target: { value: "One more question" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /^Ask$/i }).closest("form")!);

    expect(await screen.findByText(/out of Ludwitt credits/i)).toBeInTheDocument();
  });

  it("shows session-expired error on 401", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("cohort-u"),
      userProfile: { ludwitt: { sub: "lud-1" } },
      loading: false,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    const Page = (await import("@/app/cohort-ai/page")).default;
    render(<Page />);

    fireEvent.change(screen.getByPlaceholderText(/Ask anything/i), {
      target: { value: "Hello" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /^Ask$/i }).closest("form")!);

    expect(
      await screen.findByText(/Ludwitt session expired/i),
    ).toBeInTheDocument();
  });
});
