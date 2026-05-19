/**
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage push #8 — useCursorConnection (was 0% coverage).
 */
import { renderHook, act } from "@testing-library/react";
import type { User } from "firebase/auth";
import { useCursorConnection, type CursorInfo } from "@/app/(auth)/profile/_hooks/useCursorConnection";

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

const USER = {
  uid: "u1",
  getIdToken: jest.fn().mockResolvedValue("token-1"),
} as unknown as User;

const PROFILE_INFO: CursorInfo = {
  apiKeyFingerprint: "fp",
  monthlyCapUsd: 10,
  scopesConsented: ["read"],
  connectedAt: new Date("2026-05-19"),
};

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe("useCursorConnection", () => {
  it("falls back to userProfileCursor when local state is empty", () => {
    const { result } = renderHook(() =>
      useCursorConnection(USER, PROFILE_INFO, undefined, "/profile?tab=connections"),
    );
    expect(result.current.cursorInfo).toEqual(PROFILE_INFO);
  });

  it("returns null cursorInfo when nothing is provided", () => {
    const { result } = renderHook(() => useCursorConnection(USER));
    expect(result.current.cursorInfo).toBeNull();
  });

  it("connect sets error when user is null", () => {
    const { result } = renderHook(() => useCursorConnection(null));
    act(() => {
      result.current.connect();
    });
    expect(result.current.error).toContain("Please sign in");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("connect navigates to /profile/cursor when user is present", () => {
    const { result } = renderHook(() => useCursorConnection(USER));
    act(() => {
      result.current.connect();
    });
    expect(result.current.connecting).toBe(true);
    expect(mockPush).toHaveBeenCalledWith("/profile/cursor");
  });

  it("disconnect is a no-op when user is null", async () => {
    const { result } = renderHook(() => useCursorConnection(null));
    await act(async () => {
      await result.current.disconnect();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("disconnect calls /api/cursor/disconnect with bearer token and flips state", async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useCursorConnection(USER, PROFILE_INFO, refresh));
    expect(result.current.cursorInfo).toEqual(PROFILE_INFO);

    await act(async () => {
      await result.current.disconnect();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/cursor/disconnect",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer token-1" },
      }),
    );
    expect(refresh).toHaveBeenCalled();
    expect(result.current.cursorInfo).toBeNull(); // wasDisconnected wins
    expect(result.current.disconnecting).toBe(false);
  });

  it("disconnect sets error when API returns !ok", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    const { result } = renderHook(() => useCursorConnection(USER));
    await act(async () => {
      await result.current.disconnect();
    });
    expect(result.current.error).toContain("Failed to disconnect");
    expect(result.current.disconnecting).toBe(false);
  });

  it("disconnect sets error on network throw", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useCursorConnection(USER));
    await act(async () => {
      await result.current.disconnect();
    });
    expect(result.current.error).toContain("Network error");
  });

  it("handleOAuthSuccess clears wasDisconnected and routes to fallback", async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useCursorConnection(USER, PROFILE_INFO, refresh, "/profile?tab=connections"),
    );
    await act(async () => {
      await result.current.handleOAuthSuccess();
    });
    expect(refresh).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/profile?tab=connections", { scroll: false });
  });

  it("handleOAuthSuccess works without refresh callback", async () => {
    const { result } = renderHook(() => useCursorConnection(USER));
    await act(async () => {
      await result.current.handleOAuthSuccess();
    });
    expect(mockReplace).toHaveBeenCalledWith("/profile", { scroll: false });
  });

  it("handleOAuthError sets specific message for invalid_key", () => {
    const { result } = renderHook(() => useCursorConnection(USER));
    act(() => {
      result.current.handleOAuthError("invalid_key");
    });
    expect(result.current.error).toContain("could not be validated");
    expect(mockReplace).toHaveBeenCalled();
  });

  it("handleOAuthError falls back to generic message", () => {
    const { result } = renderHook(() => useCursorConnection(USER));
    act(() => {
      result.current.handleOAuthError("something_else");
    });
    expect(result.current.error).toContain("Failed to connect Cursor");
  });
});
