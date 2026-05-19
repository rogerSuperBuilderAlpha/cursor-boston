/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";

const mockUseAuth = useAuth as jest.Mock;

describe("auth pages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ primaryEmail: "primary@example.com" }),
    }) as typeof fetch;
  });

  it("renders signup validation and submits credentials", async () => {
    const signUp = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signUp,
      signInWithGoogle: jest.fn(),
      signInWithGithub: jest.fn(),
    });
    const Page = (await import("@/app/(auth)/signup/page")).default;
    render(<Page />);

    fireEvent.change(screen.getByLabelText(/^Name/i), { target: { value: "New User" } });
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password/i), {
      target: { value: "different123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    expect(await screen.findByText(/Passwords do not match/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Confirm Password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith("new@example.com", "password123", "New User");
    });
  });

  it("renders login, resolves aliases, and sends reset email", async () => {
    const signIn = jest.fn().mockResolvedValue(undefined);
    const resetPassword = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      signIn,
      signInWithGoogle: jest.fn(),
      signInWithGithub: jest.fn(),
      resetPassword,
    });
    const Page = (await import("@/app/(auth)/login/page")).default;
    render(<Page />);

    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: "alias@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: /^Sign In$/i }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("primary@example.com", "secret123");
    });

    fireEvent.click(screen.getByRole("button", { name: /Forgot password/i }));

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith("primary@example.com");
    });
  });
});
