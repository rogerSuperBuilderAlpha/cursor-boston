/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { useOAuthCallbacks } from "@/app/(auth)/profile/_hooks/useOAuthCallbacks";

function makeSearchParams(query: string): ReadonlyURLSearchParams {
  return new URLSearchParams(query) as ReadonlyURLSearchParams;
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    loading: false,
    searchParams: makeSearchParams(""),
    router: { replace: jest.fn() },
    discord: {
      handleOAuthSuccess: jest.fn(),
      handleOAuthError: jest.fn(),
    },
    github: {
      handleOAuthSuccess: jest.fn(),
      handleOAuthError: jest.fn(),
    },
    ludwitt: {
      handleOAuthSuccess: jest.fn(),
      handleOAuthError: jest.fn(),
    },
    cursor: {
      handleOAuthSuccess: jest.fn(),
      handleOAuthError: jest.fn(),
    },
    email: {
      setVerificationStatus: jest.fn(),
    },
    refreshUserProfile: jest.fn().mockResolvedValue(undefined),
    setActiveTab: jest.fn(),
    ...overrides,
  };
}

describe("useOAuthCallbacks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does nothing while auth is loading", async () => {
    const deps = makeDeps({
      loading: true,
      searchParams: makeSearchParams("discord=success&data=%7B%22id%22%3A1%7D"),
    });

    renderHook(() => useOAuthCallbacks(deps));

    await waitFor(() => {
      expect(deps.discord.handleOAuthSuccess).not.toHaveBeenCalled();
    });
  });

  it("handles Discord OAuth success", async () => {
    const payload = encodeURIComponent(JSON.stringify({ username: "dev" }));
    const deps = makeDeps({
      searchParams: makeSearchParams(`discord=success&data=${payload}`),
    });

    renderHook(() => useOAuthCallbacks(deps));

    await waitFor(() => {
      expect(deps.discord.handleOAuthSuccess).toHaveBeenCalledWith({
        username: "dev",
      });
    });
  });

  it("handles Discord OAuth error", async () => {
    const deps = makeDeps({
      searchParams: makeSearchParams("discord=error&message=denied"),
    });

    renderHook(() => useOAuthCallbacks(deps));

    await waitFor(() => {
      expect(deps.discord.handleOAuthError).toHaveBeenCalledWith("denied");
    });
  });

  it("handles GitHub OAuth success and error", async () => {
    const payload = encodeURIComponent(JSON.stringify({ login: "octocat" }));
    const successDeps = makeDeps({
      searchParams: makeSearchParams(`github=success&data=${payload}`),
    });
    renderHook(() => useOAuthCallbacks(successDeps));
    await waitFor(() => {
      expect(successDeps.github.handleOAuthSuccess).toHaveBeenCalledWith({
        login: "octocat",
      });
    });

    const errorDeps = makeDeps({
      searchParams: makeSearchParams("github=error"),
    });
    renderHook(() => useOAuthCallbacks(errorDeps));
    await waitFor(() => {
      expect(errorDeps.github.handleOAuthError).toHaveBeenCalled();
    });
  });

  it("handles Ludwitt and Cursor connect callbacks", async () => {
    const ludwittDeps = makeDeps({
      searchParams: makeSearchParams("ludwitt=success"),
    });
    renderHook(() => useOAuthCallbacks(ludwittDeps));
    await waitFor(() => {
      expect(ludwittDeps.ludwitt.handleOAuthSuccess).toHaveBeenCalled();
    });

    const cursorDeps = makeDeps({
      searchParams: makeSearchParams("cursor=error&message=expired"),
    });
    renderHook(() => useOAuthCallbacks(cursorDeps));
    await waitFor(() => {
      expect(cursorDeps.cursor.handleOAuthError).toHaveBeenCalledWith("expired");
    });
  });

  it("handles email verification success", async () => {
    const deps = makeDeps({
      searchParams: makeSearchParams(
        "emailVerification=success&tab=security"
      ),
    });

    renderHook(() => useOAuthCallbacks(deps));

    await waitFor(() => {
      expect(deps.email.setVerificationStatus).toHaveBeenCalledWith({
        type: "success",
        message: "Email verified and added to your account successfully!",
      });
      expect(deps.refreshUserProfile).toHaveBeenCalled();
      expect(deps.setActiveTab).toHaveBeenCalledWith("security");
      expect(deps.router.replace).toHaveBeenCalledWith("/profile", {
        scroll: false,
      });
    });
  });

  it("maps email verification error codes to user-facing messages", async () => {
    const deps = makeDeps({
      searchParams: makeSearchParams(
        "emailVerification=error&message=token_expired"
      ),
    });

    renderHook(() => useOAuthCallbacks(deps));

    await waitFor(() => {
      expect(deps.email.setVerificationStatus).toHaveBeenCalledWith({
        type: "error",
        message: "This verification link has expired. Please request a new one.",
      });
      expect(deps.setActiveTab).toHaveBeenCalledWith("security");
      expect(deps.router.replace).toHaveBeenCalledWith("/profile", {
        scroll: false,
      });
    });
  });

  it("falls back for unknown email verification errors", async () => {
    const deps = makeDeps({
      searchParams: makeSearchParams("emailVerification=error&message=unknown"),
    });

    renderHook(() => useOAuthCallbacks(deps));

    await waitFor(() => {
      expect(deps.email.setVerificationStatus).toHaveBeenCalledWith({
        type: "error",
        message: "Failed to verify email.",
      });
    });
  });
});
