/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/(auth)/profile/_contexts/ProfileContext.tsx`
 * was at 23.4% statements (49 uncovered) with no dedicated tests. This
 * suite exercises the password-set happy/error paths and the sign-out
 * error path by rendering the provider with a minimal mock graph.
 */

import React from "react";
import { act, render } from "@testing-library/react";

const mockUpdatePassword = jest.fn();
const mockLinkWithCredential = jest.fn();
const mockCredential = jest.fn((email: string, pw: string) => ({ email, pw }));

jest.mock("firebase/auth", () => ({
  EmailAuthProvider: { credential: (...args: unknown[]) => mockCredential(...(args as [string, string])) },
  linkWithCredential: (...args: unknown[]) => mockLinkWithCredential(...args),
  updatePassword: (...args: unknown[]) => mockUpdatePassword(...args),
}));

jest.mock("@/lib/firebase", () => ({
  auth: { currentUser: null },
}));

const mockSignOut = jest.fn();
const mockSendAddEmailVerification = jest.fn();
const mockRemoveAdditionalEmail = jest.fn();
const mockChangePrimaryEmail = jest.fn();
const mockRefreshUserProfile = jest.fn();

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    userProfile: { github: { login: "octocat" }, provider: "google" },
    signOut: mockSignOut,
    sendAddEmailVerification: mockSendAddEmailVerification,
    removeAdditionalEmail: mockRemoveAdditionalEmail,
    changePrimaryEmail: mockChangePrimaryEmail,
    refreshUserProfile: mockRefreshUserProfile,
  }),
}));

jest.mock("@/app/(auth)/profile/_hooks/useProfileData", () => ({
  useProfileData: jest.fn(() => ({ profileBundle: { stars: 0 } })),
}));

jest.mock("@/app/(auth)/profile/_hooks/useBadges", () => ({
  useBadges: jest.fn(() => ({ awarded: [] })),
}));

jest.mock("@/app/(auth)/profile/_hooks/useDiscordConnection", () => ({
  useDiscordConnection: jest.fn(() => ({ connected: false })),
}));

jest.mock("@/app/(auth)/profile/_hooks/useGithubConnection", () => ({
  useGithubConnection: jest.fn(() => ({ connected: true })),
}));

let googleHasPasswordProvider = true;
jest.mock("@/app/(auth)/profile/_hooks/useGoogleConnection", () => ({
  useGoogleConnection: jest.fn(() => ({
    get hasPasswordProvider() {
      return googleHasPasswordProvider;
    },
  })),
}));

jest.mock("@/app/(auth)/profile/_hooks/useLudwittConnection", () => ({
  useLudwittConnection: jest.fn(() => ({ connected: false })),
}));

jest.mock("@/app/(auth)/profile/_hooks/useCursorConnection", () => ({
  useCursorConnection: jest.fn(() => ({ connected: false })),
}));

jest.mock("@/app/(auth)/profile/_hooks/useMfaEnrollment", () => ({
  useMfaEnrollment: jest.fn(() => ({ enrolled: false })),
}));

jest.mock("@/app/(auth)/profile/_hooks/useEmailManagement", () => ({
  useEmailManagement: jest.fn(() => ({ additionalEmails: [] })),
}));

jest.mock("@/app/(auth)/profile/_hooks/useProfileSettings", () => ({
  useProfileSettings: jest.fn(() => ({ displayName: "Test User" })),
}));

import {
  ProfileProvider,
  useProfileContext,
} from "@/app/(auth)/profile/_contexts/ProfileContext";

interface CapturedCtx {
  current: ReturnType<typeof useProfileContext> | null;
}

function Probe({ captured }: { captured: CapturedCtx }) {
  captured.current = useProfileContext();
  return null;
}

function renderWithUser(user: Partial<{ uid: string; email: string | null }> = {}) {
  const captured: CapturedCtx = { current: null };
  const baseUser = { uid: "u1", email: "u@test.com", ...user } as unknown as {
    uid: string;
    email: string | null;
  };
  render(
    <ProfileProvider user={baseUser as never}>
      <Probe captured={captured} />
    </ProfileProvider>
  );
  return captured;
}

describe("ProfileContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    googleHasPasswordProvider = true;
  });

  it("throws useful error when useProfileContext is used outside the provider", () => {
    const Bad = () => {
      useProfileContext();
      return null;
    };
    const consoleErr = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/within ProfileProvider/);
    consoleErr.mockRestore();
  });

  it("exposes the full context graph (data, badges, connections, password, sign-out)", () => {
    const c = renderWithUser();
    expect(c.current).toBeTruthy();
    expect(c.current?.user.uid).toBe("u1");
    expect(c.current?.data).toEqual({ profileBundle: { stars: 0 } });
    expect(c.current?.badges).toEqual({ awarded: [] });
    expect(c.current?.discord.connected).toBe(false);
    expect(c.current?.github.connected).toBe(true);
    expect(c.current?.password.saving).toBe(false);
    expect(c.current?.password.error).toBeNull();
    expect(c.current?.isSigningOut).toBe(false);
    expect(c.current?.signOutError).toBeNull();
  });

  it("password.setPassword: returns early when user has no email", async () => {
    const c = renderWithUser({ email: null });
    await act(async () => {
      await c.current?.password.setPassword("newpass123");
    });
    expect(c.current?.password.error).toMatch(/No email/);
    expect(mockUpdatePassword).not.toHaveBeenCalled();
    expect(mockLinkWithCredential).not.toHaveBeenCalled();
  });

  it("password.setPassword: calls updatePassword when hasPasswordProvider=true", async () => {
    googleHasPasswordProvider = true;
    mockUpdatePassword.mockResolvedValue(undefined);
    const c = renderWithUser();
    await act(async () => {
      await c.current?.password.setPassword("newpass123");
    });
    expect(mockUpdatePassword).toHaveBeenCalled();
    expect(mockLinkWithCredential).not.toHaveBeenCalled();
  });

  it("password.setPassword: links with credential when hasPasswordProvider=false", async () => {
    googleHasPasswordProvider = false;
    mockLinkWithCredential.mockResolvedValue(undefined);
    const c = renderWithUser();
    await act(async () => {
      await c.current?.password.setPassword("newpass123");
    });
    expect(mockLinkWithCredential).toHaveBeenCalled();
    expect(mockUpdatePassword).not.toHaveBeenCalled();
    expect(mockCredential).toHaveBeenCalledWith("u@test.com", "newpass123");
  });

  it("password.setPassword: sets error message on firebase throw", async () => {
    googleHasPasswordProvider = true;
    mockUpdatePassword.mockRejectedValue(new Error("auth/requires-recent-login"));
    const c = renderWithUser();
    await act(async () => {
      await c.current?.password.setPassword("newpass123");
    });
    expect(c.current?.password.error).toMatch(/Failed to set password/);
    expect(c.current?.password.success).toBe(false);
    expect(c.current?.password.saving).toBe(false);
  });

  it("handleSignOut: calls signOut on success", async () => {
    mockSignOut.mockResolvedValue(undefined);
    const c = renderWithUser();
    await act(async () => {
      await c.current?.handleSignOut();
    });
    expect(mockSignOut).toHaveBeenCalled();
    expect(c.current?.signOutError).toBeNull();
  });

  it("handleSignOut: surfaces Error message on signOut failure", async () => {
    mockSignOut.mockRejectedValue(new Error("network down"));
    const c = renderWithUser();
    await act(async () => {
      await c.current?.handleSignOut();
    });
    expect(c.current?.signOutError).toBe("network down");
    expect(c.current?.isSigningOut).toBe(false);
  });

  it("handleSignOut: surfaces generic fallback on non-Error throw", async () => {
    mockSignOut.mockRejectedValue("string-rejection");
    const c = renderWithUser();
    await act(async () => {
      await c.current?.handleSignOut();
    });
    expect(c.current?.signOutError).toMatch(/Failed to sign out/);
  });
});
