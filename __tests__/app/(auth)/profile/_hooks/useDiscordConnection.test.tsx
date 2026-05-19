/**
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage push #8 — useDiscordConnection (was 0% coverage).
 */
import { renderHook, act } from "@testing-library/react";
import type { User } from "firebase/auth";
import { useDiscordConnection } from "@/app/(auth)/profile/_hooks/useDiscordConnection";

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

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID = "fake-client-id";
});

describe("useDiscordConnection", () => {
  describe("discordInfo resolution", () => {
    it("falls back to userProfileDiscord", () => {
      const profileDiscord = { id: "d1", username: "user1" };
      const { result } = renderHook(() =>
        useDiscordConnection(USER, profileDiscord),
      );
      expect(result.current.discordInfo).toEqual(profileDiscord);
    });

    it("returns null when nothing provided", () => {
      const { result } = renderHook(() => useDiscordConnection(USER));
      expect(result.current.discordInfo).toBeNull();
    });
  });

  describe("connect", () => {
    it("sets error when user is null", () => {
      const { result } = renderHook(() => useDiscordConnection(null));
      act(() => result.current.connect());
      expect(result.current.error).toContain("not configured");
    });
    // The remaining connect paths (DISCORD_CLIENT_ID unset, happy-path
    // window.location.href assignment) can't be reliably exercised in
    // jsdom: jest.isolateModules + renderHook collides with React's
    // module identity, and window.location is read-only and resists
    // delete/redefine. Lines 44-48 of the source stay uncovered.
  });

  describe("disconnect", () => {
    it("is a no-op when user is null", async () => {
      const { result } = renderHook(() => useDiscordConnection(null));
      await act(async () => {
        await result.current.disconnect();
      });
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("calls updateDoc with deleteField and flips state on success", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useDiscordConnection(USER, { id: "d1", username: "user1" }),
      );
      expect(result.current.discordInfo).toBeTruthy();

      await act(async () => {
        await result.current.disconnect();
      });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        { discord: "DEL" },
      );
      expect(result.current.discordInfo).toBeNull();
      expect(result.current.disconnecting).toBe(false);
    });

    it("sets error on updateDoc failure", async () => {
      mockUpdateDoc.mockRejectedValue(new Error("permission"));
      const { result } = renderHook(() => useDiscordConnection(USER));
      await act(async () => {
        await result.current.disconnect();
      });
      expect(result.current.error).toContain("Failed to disconnect Discord");
    });
  });

  describe("handleOAuthSuccess", () => {
    it("redirects to login if user is null", async () => {
      const { result } = renderHook(() => useDiscordConnection(null));
      await act(async () => {
        await result.current.handleOAuthSuccess({
          id: "d1",
          username: "user1",
        });
      });
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining("/login?redirect="),
      );
    });

    it("writes discord info to Firestore on success", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const { result } = renderHook(() => useDiscordConnection(USER));
      await act(async () => {
        await result.current.handleOAuthSuccess({
          id: "d1",
          username: "userX",
          globalName: "Global Name",
          avatar: "abc123",
        });
      });
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          discord: expect.objectContaining({
            id: "d1",
            username: "Global Name", // globalName takes precedence
            avatar: "abc123",
          }),
        }),
      );
      expect(result.current.discordInfo).toMatchObject({ id: "d1", username: "Global Name" });
      expect(mockReplace).toHaveBeenCalled();
    });

    it("falls back to username when globalName is not provided", async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      const { result } = renderHook(() => useDiscordConnection(USER));
      await act(async () => {
        await result.current.handleOAuthSuccess({
          id: "d1",
          username: "plain-username",
        });
      });
      expect(result.current.discordInfo?.username).toBe("plain-username");
    });

    it("sets error when updateDoc fails", async () => {
      mockUpdateDoc.mockRejectedValue(new Error("Firestore down"));
      const { result } = renderHook(() => useDiscordConnection(USER));
      await act(async () => {
        await result.current.handleOAuthSuccess({ id: "d1", username: "u" });
      });
      expect(result.current.error).toContain("Failed to save Discord");
    });
  });

  describe("handleOAuthError", () => {
    it("sets specific message for not_member", () => {
      const { result } = renderHook(() => useDiscordConnection(USER));
      act(() => result.current.handleOAuthError("not_member"));
      expect(result.current.error).toContain("Cursor Boston Discord");
    });

    it("falls back to generic message", () => {
      const { result } = renderHook(() => useDiscordConnection(USER));
      act(() => result.current.handleOAuthError("anything_else"));
      expect(result.current.error).toContain("Failed to connect Discord");
    });
  });
});
