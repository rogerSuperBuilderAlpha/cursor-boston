/**
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage push #7 — useEmailManagement (was 0% coverage).
 */
import { renderHook, act } from "@testing-library/react";
import type { User } from "firebase/auth";
import { useEmailManagement } from "@/app/(auth)/profile/_hooks/useEmailManagement";

const USER = { uid: "u1" } as unknown as User;

function setup(overrides: Partial<{
  sendAddEmailVerification: jest.Mock;
  removeAdditionalEmail: jest.Mock;
  changePrimaryEmail: jest.Mock;
}> = {}) {
  const sendAddEmailVerification = overrides.sendAddEmailVerification ?? jest.fn().mockResolvedValue(undefined);
  const removeAdditionalEmail = overrides.removeAdditionalEmail ?? jest.fn().mockResolvedValue(undefined);
  const changePrimaryEmail = overrides.changePrimaryEmail ?? jest.fn().mockResolvedValue(undefined);
  return {
    sendAddEmailVerification,
    removeAdditionalEmail,
    changePrimaryEmail,
    hook: renderHook(() =>
      useEmailManagement({
        user: USER,
        sendAddEmailVerification,
        removeAdditionalEmail,
        changePrimaryEmail,
      })
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useEmailManagement", () => {
  describe("addEmail", () => {
    it("rejects empty input with an error", async () => {
      const { hook, sendAddEmailVerification } = setup();
      await act(async () => {
        await hook.result.current.addEmail();
      });
      expect(hook.result.current.addError).toBe("Please enter an email address");
      expect(sendAddEmailVerification).not.toHaveBeenCalled();
    });

    it("rejects whitespace-only input", async () => {
      const { hook } = setup();
      act(() => hook.result.current.setNewEmail("   "));
      await act(async () => {
        await hook.result.current.addEmail();
      });
      expect(hook.result.current.addError).toBe("Please enter an email address");
    });

    it("sends verification on success and clears newEmail", async () => {
      const { hook, sendAddEmailVerification } = setup();
      act(() => hook.result.current.setNewEmail("new@example.com"));
      await act(async () => {
        await hook.result.current.addEmail();
      });
      expect(sendAddEmailVerification).toHaveBeenCalledWith("new@example.com");
      expect(hook.result.current.addSuccess).toContain("Verification email sent");
      expect(hook.result.current.newEmail).toBe("");
      expect(hook.result.current.addLoading).toBe(false);
    });

    it("captures Error.message on failure", async () => {
      const send = jest.fn().mockRejectedValue(new Error("server down"));
      const { hook } = setup({ sendAddEmailVerification: send });
      act(() => hook.result.current.setNewEmail("new@example.com"));
      await act(async () => {
        await hook.result.current.addEmail();
      });
      expect(hook.result.current.addError).toBe("server down");
      expect(hook.result.current.addLoading).toBe(false);
    });

    it("falls back to generic message on non-Error throw", async () => {
      const send = jest.fn().mockRejectedValue("string-thrown");
      const { hook } = setup({ sendAddEmailVerification: send });
      act(() => hook.result.current.setNewEmail("new@example.com"));
      await act(async () => {
        await hook.result.current.addEmail();
      });
      expect(hook.result.current.addError).toContain("Failed to send verification email");
    });
  });

  describe("removeEmail", () => {
    it("removes successfully and clears removeLoading", async () => {
      const { hook, removeAdditionalEmail } = setup();
      await act(async () => {
        await hook.result.current.removeEmail("old@example.com");
      });
      expect(removeAdditionalEmail).toHaveBeenCalledWith("old@example.com");
      expect(hook.result.current.removeLoading).toBeNull();
    });

    it("logs and recovers on remove failure", async () => {
      const remove = jest.fn().mockRejectedValue(new Error("not allowed"));
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const { hook } = setup({ removeAdditionalEmail: remove });
      await act(async () => {
        await hook.result.current.removeEmail("old@example.com");
      });
      expect(consoleSpy).toHaveBeenCalled();
      expect(hook.result.current.removeLoading).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe("makePrimary", () => {
    // The "happy path" for makePrimary calls window.location.reload(),
    // which jsdom blocks from being spied on or redefined. The reload
    // call itself can't be asserted here; the failure-path test below
    // exercises the error branch. Source line 70 stays uncovered.

    it("logs and clears primaryLoading on failure", async () => {
      const change = jest.fn().mockRejectedValue(new Error("nope"));
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      const { hook } = setup({ changePrimaryEmail: change });
      await act(async () => {
        await hook.result.current.makePrimary("new@example.com");
      });
      expect(consoleSpy).toHaveBeenCalled();
      expect(hook.result.current.primaryLoading).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  it("exposes setVerificationStatus for verification flow callers", () => {
    const { hook } = setup();
    act(() => {
      hook.result.current.setVerificationStatus({
        type: "success",
        message: "Email verified",
      });
    });
    expect(hook.result.current.verificationStatus).toEqual({
      type: "success",
      message: "Email verified",
    });
  });
});
