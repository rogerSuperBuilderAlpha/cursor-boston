/**
 * @jest-environment jsdom
 */

const mockPush = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/profile/cursor",
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

describe("Cursor connection page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    global.fetch = jest.fn();
  });

  it("shows loading skeleton while auth loads", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: true,
      refreshUserProfile: jest.fn(),
    });
    const Page = (await import("@/app/(auth)/profile/cursor/page")).default;
    const { container } = render(<Page />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("connects with API key and navigates to return path", async () => {
    const refreshUserProfile = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("cursor-u"),
      userProfile: null,
      loading: false,
      refreshUserProfile,
    });
    mockSearchParams = new URLSearchParams("return=/pr-ideas");
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });

    const Page = (await import("@/app/(auth)/profile/cursor/page")).default;
    render(<Page />);

    fireEvent.change(screen.getByPlaceholderText(/cursor_/i), {
      target: { value: "cursor_test_key_123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /\$25/i }));
    fireEvent.click(screen.getByRole("button", { name: /Connect Cursor/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/cursor/connect",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ apiKey: "cursor_test_key_123", monthlyCapUsd: 25 }),
        }),
      );
    });
    await waitFor(() => {
      expect(refreshUserProfile).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/pr-ideas");
    });
  });

  it("shows invalid key error from API", async () => {
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("cursor-u"),
      userProfile: null,
      loading: false,
      refreshUserProfile: jest.fn(),
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "invalid_key" }),
    });

    const Page = (await import("@/app/(auth)/profile/cursor/page")).default;
    render(<Page />);

    fireEvent.change(screen.getByPlaceholderText(/cursor_/i), {
      target: { value: "bad-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Connect Cursor/i }));

    expect(
      await screen.findByText(/could not be validated/i),
    ).toBeInTheDocument();
  });

  it("renders connected state and disconnects", async () => {
    const refreshUserProfile = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("cursor-u"),
      userProfile: {
        cursor: {
          apiKeyFingerprint: "…abc123",
          connectedAt: { toDate: () => new Date("2026-01-15T12:00:00Z") },
          monthlyCapUsd: 0,
          defaultModel: "claude-sonnet",
        },
      },
      loading: false,
      refreshUserProfile,
    });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });

    const Page = (await import("@/app/(auth)/profile/cursor/page")).default;
    render(<Page />);

    expect(screen.getByText(/Connected as/i)).toBeInTheDocument();
    expect(screen.getByText(/Unlimited/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Disconnect Cursor/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/cursor/disconnect",
        expect.objectContaining({ method: "POST" }),
      );
    });
    await waitFor(() => {
      expect(refreshUserProfile).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/profile?cursor=disconnected");
    });
  });
});
