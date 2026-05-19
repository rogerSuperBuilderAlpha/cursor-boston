/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import { useLudwittConnection } from "@/app/(auth)/profile/_hooks/useLudwittConnection";

const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockUser = {
  getIdToken: jest.fn().mockResolvedValue("ludwitt-token"),
} as unknown as User;

const profileInfo = {
  sub: "lud-1",
  email: "lud@example.com",
  name: "Ludwitt User",
};

describe("useLudwittConnection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it("prefers disconnected state over profile info after disconnect", async () => {
    const refreshUserProfile = jest.fn().mockResolvedValue(undefined);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const { result } = renderHook(() =>
      useLudwittConnection(mockUser, profileInfo, refreshUserProfile, "/profile?tab=connections"),
    );

    expect(result.current.ludwittInfo).toEqual(profileInfo);

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.ludwittInfo).toBeNull();
    expect(refreshUserProfile).toHaveBeenCalled();
  });

  it("sets an error when connect is attempted while signed out", async () => {
    const { result } = renderHook(() => useLudwittConnection(null, null));

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.error).toMatch(/sign in/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("starts OAuth after a successful connect-start response", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ authorizeUrl: "https://ludwitt.example/oauth" }),
    });

    const { result } = renderHook(() =>
      useLudwittConnection(mockUser, null, undefined, "/profile"),
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.connecting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/ludwitt/connect-start",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer ludwitt-token",
        }),
        body: JSON.stringify({ returnTo: "/profile" }),
      }),
    );
  });

  it("surfaces not_configured errors from connect-start", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "not_configured" }),
    });

    const { result } = renderHook(() => useLudwittConnection(mockUser, null));

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.error).toMatch(/isn't configured/i);
  });

  it("surfaces generic connect failures", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "server_error" }),
    });

    const { result } = renderHook(() => useLudwittConnection(mockUser, null));

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.error).toMatch(/Couldn't start/i);
  });

  it("handles network errors during connect", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useLudwittConnection(mockUser, null));

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.error).toMatch(/Network error/i);
  });

  it("no-ops disconnect when signed out", async () => {
    const { result } = renderHook(() => useLudwittConnection(null, profileInfo));

    await act(async () => {
      await result.current.disconnect();
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.ludwittInfo).toEqual(profileInfo);
  });

  it("handles disconnect failures and network errors", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false })
      .mockRejectedValueOnce(new Error("offline"));

    const { result } = renderHook(() => useLudwittConnection(mockUser, profileInfo));

    await act(async () => {
      await result.current.disconnect();
    });
    expect(result.current.error).toMatch(/Failed to disconnect/i);

    await act(async () => {
      await result.current.disconnect();
    });
    expect(result.current.error).toMatch(/Network error/i);
  });

  it("refreshes profile and replaces route on OAuth success", async () => {
    const refreshUserProfile = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useLudwittConnection(mockUser, null, refreshUserProfile, "/profile"),
    );

    await act(async () => {
      await result.current.handleOAuthSuccess();
    });

    await waitFor(() => {
      expect(refreshUserProfile).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith("/profile", { scroll: false });
    });
  });

  it("maps OAuth errors and replaces route", async () => {
    const { result } = renderHook(() =>
      useLudwittConnection(mockUser, null, undefined, "/profile"),
    );

    act(() => {
      result.current.handleOAuthError("access_denied");
    });

    expect(result.current.error).toMatch(/declined/i);
    expect(mockReplace).toHaveBeenCalledWith("/profile", { scroll: false });
  });
});
