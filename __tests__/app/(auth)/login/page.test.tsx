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
  usePathname: () => "/login",
  useParams: () => ({}),
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";

const mockUseAuth = useAuth as jest.Mock;

describe("login page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ primaryEmail: "primary@example.com" }),
    }) as typeof fetch;
  });

  it("shows summer cohort banner when redirect targets cohort", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signIn: jest.fn(),
      signInWithGoogle: jest.fn(),
      signInWithGithub: jest.fn(),
      resetPassword: jest.fn(),
    });
    mockSearchParams = new URLSearchParams("redirect=/summer-cohort/apply");

    const Page = (await import("@/app/(auth)/login/page")).default;
    render(<Page />);

    expect(
      screen.getByText(/Sign in to finish your application/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Summer Cohort 2/i).length).toBeGreaterThan(0);
  });

  it("maps firebase errors to friendly messages", async () => {
    const signIn = jest.fn().mockRejectedValue(new Error("auth/wrong-password"));
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signIn,
      signInWithGoogle: jest.fn(),
      signInWithGithub: jest.fn(),
      resetPassword: jest.fn(),
    });

    const Page = (await import("@/app/(auth)/login/page")).default;
    render(<Page />);

    fireEvent.change(screen.getByLabelText(/^Email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Password/i), {
      target: { value: "bad" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Sign In$/i }));

    expect(
      await screen.findByText(/Invalid email or password/i),
    ).toBeInTheDocument();
  });

  it("shows Ludwitt OAuth error banner from query params", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signIn: jest.fn(),
      signInWithGoogle: jest.fn(),
      signInWithGithub: jest.fn(),
      resetPassword: jest.fn(),
    });
    mockSearchParams = new URLSearchParams("ludwitt=error&message=access_denied");

    const Page = (await import("@/app/(auth)/login/page")).default;
    render(<Page />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("redirects authenticated users", async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: "u1" },
      loading: false,
      signIn: jest.fn(),
      signInWithGoogle: jest.fn(),
      signInWithGithub: jest.fn(),
      resetPassword: jest.fn(),
    });
    mockSearchParams = new URLSearchParams("redirect=/game");

    const Page = (await import("@/app/(auth)/login/page")).default;
    render(<Page />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/game");
    });
  });

  it("signs in with Google and GitHub", async () => {
    const signInWithGoogle = jest.fn().mockResolvedValue(undefined);
    const signInWithGithub = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signIn: jest.fn(),
      signInWithGoogle,
      signInWithGithub,
      resetPassword: jest.fn(),
    });

    const Page = (await import("@/app/(auth)/login/page")).default;
    render(<Page />);

    fireEvent.click(screen.getByRole("button", { name: /Continue with Google/i }));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Continue with GitHub/i }));
    await waitFor(() => expect(signInWithGithub).toHaveBeenCalled());
  });

  it("requires email before password reset", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signIn: jest.fn(),
      signInWithGoogle: jest.fn(),
      signInWithGithub: jest.fn(),
      resetPassword: jest.fn(),
    });

    const Page = (await import("@/app/(auth)/login/page")).default;
    render(<Page />);

    fireEvent.click(screen.getByRole("button", { name: /Forgot password/i }));
    expect(
      await screen.findByText(/enter your email address first/i),
    ).toBeInTheDocument();
  });
});
