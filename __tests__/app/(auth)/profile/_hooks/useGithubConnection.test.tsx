/**
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage push #10 — useGithubConnection (was 0%).
 */
import { renderHook, act } from "@testing-library/react";
import type { User } from "firebase/auth";
import { useGithubConnection } from "@/app/(auth)/profile/_hooks/useGithubConnection";

const mockReplace = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((db, col, id) => ({ db, col, id })),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: jest.fn(() => "TS"),
  deleteField: jest.fn(() => "DEL"),
}));

jest.mock("@/lib/firebase", () => ({ db: { fake: true } }));

const USER = { uid: "u1" } as unknown as User;
const PROFILE_INFO = {
  id: "gh-1",
  login: "user",
  html_url: "https://github.com/user",
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID = "fake-client";
});

describe("useGithubConnection", () => {
  describe("githubInfo / hasGithubConnection resolution", () => {
    it("falls back to userProfileGithub when local state empty", () => {
      const { result } = renderHook(() =>
        useGithubConnection(USER, PROFILE_INFO),
      );
      expect(result.current.githubInfo).toEqual(PROFILE_INFO);
      expect(result.current.hasGithubConnection).toBe(true);
    });

    it("returns null githubInfo when nothing provided", () => {
      const { result } = renderHook(() => useGithubConnection(USER));
      expect(result.current.githubInfo).toBeNull();
      expect(result.current.hasGithubConnection).toBe(false);
    });

    it("hasGithubConnection=true when userProvider=github", () => {
      const { result } = renderHook(() =>
        useGithubConnection(USER, null, "github"),
      );
      expect(result.current.hasGithubConnection).toBe(true);
    });
  });

  describe("connect", () => {
    it("sets error when user is null", () => {
      const { result } = renderHook(() => useGithubConnection(null));
      act(() => result.current.connect());
      expect(result.current.error).toContain("not configured");
    });
  });

  describe("disconnect", () => {
    it("is a no-op when user is null", async () => {
      const { result } = renderHook(() => useGithubConnection(null));
      await act(async () => {
        await result.current.disconnect();
      });
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("calls updateDoc with deleteField and flips state on success", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useGithubConnection(USER, PROFILE_INFO),
      );
      expect(result.current.githubInfo).toBeTruthy();

      await act(async () => {
        await result.current.disconnect();
      });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { github: "DEL" },
      );
      expect(result.current.githubInfo).toBeNull();
      expect(result.current.disconnecting).toBe(false);
    });

    it("sets error on updateDoc failure", async () => {
      mockUpdateDoc.mockRejectedValue(new Error("permission"));
      const { result } = renderHook(() => useGithubConnection(USER));
      await act(async () => {
        await result.current.disconnect();
      });
      expect(result.current.error).toContain("Failed to disconnect GitHub");
    });
  });

  describe("handleOAuthSuccess", () => {
    it("redirects to login when user is null", async () => {
      const { result } = renderHook(() => useGithubConnection(null));
      await act(async () => {
        await result.current.handleOAuthSuccess({
          id: "gh-1",
          login: "user",
          html_url: "x",
        });
      });
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining("/login?redirect="),
      );
    });

    it("writes github info on success", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const { result } = renderHook(() => useGithubConnection(USER));
      await act(async () => {
        await result.current.handleOAuthSuccess({
          id: "gh-1",
          login: "user",
          name: "User Name",
          avatar_url: "https://avatar",
          html_url: "https://github.com/user",
        });
      });
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          github: expect.objectContaining({
            id: "gh-1",
            login: "user",
            name: "User Name",
          }),
        }),
      );
      expect(result.current.githubInfo).toMatchObject({ login: "user" });
    });

    it("sets error when updateDoc fails", async () => {
      mockUpdateDoc.mockRejectedValue(new Error("Firestore down"));
      const { result } = renderHook(() => useGithubConnection(USER));
      await act(async () => {
        await result.current.handleOAuthSuccess({
          id: "g",
          login: "u",
          html_url: "x",
        });
      });
      expect(result.current.error).toContain("Failed to save GitHub");
    });
  });

  describe("handleOAuthError", () => {
    it("falls back to generic message", () => {
      const { result } = renderHook(() => useGithubConnection(USER));
      act(() => result.current.handleOAuthError("anything"));
      expect(result.current.error).toContain("Failed to connect GitHub");
    });
  });

  it("exposes setError to clear external errors", () => {
    const { result } = renderHook(() => useGithubConnection(USER));
    act(() => result.current.setError("forced"));
    expect(result.current.error).toBe("forced");
  });
});
