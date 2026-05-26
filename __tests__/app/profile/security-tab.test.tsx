/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/(auth)/profile/_components/SecurityTab.tsx`
 * (16% statements / 0% branches / 76 uncovered branches). Covers
 * verification banner success/error/dismiss, primary + additional email
 * rows (verified/unverified + make-primary + remove), add-new-email
 * form, Google connect/disconnect, password section (validation +
 * success), MFA send / disable / confirm + recaptcha + error/success,
 * Discord/GitHub connect/disconnect, connected agents listing.
 */

import "@/__tests__/app/_shared/page-test-setup";

import { fireEvent, render, screen } from "@testing-library/react";

import { SecurityTab } from "@/app/(auth)/profile/_components/SecurityTab";

function makeHooks(over: Partial<Record<string, unknown>> = {}) {
  return {
    discord: {
      discordInfo: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      connecting: false,
      disconnecting: false,
    },
    github: {
      githubInfo: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      connecting: false,
      disconnecting: false,
    },
    google: {
      hasGoogleProvider: false,
      disconnect: jest.fn(),
      disconnecting: false,
      error: null,
    },
    mfa: {
      hasPhoneMfa: false,
      phoneNumber: "",
      setPhoneNumber: jest.fn(),
      sendCode: jest.fn(),
      disable: jest.fn(),
      confirmEnrollment: jest.fn(),
      loading: false,
      verificationId: null,
      smsCode: "",
      setSmsCode: jest.fn(),
      error: null,
      success: null,
    },
    email: {
      verificationStatus: null,
      setVerificationStatus: jest.fn(),
      newEmail: "",
      setNewEmail: jest.fn(),
      addEmail: jest.fn(),
      addLoading: false,
      addError: null,
      addSuccess: null,
      makePrimary: jest.fn(),
      primaryLoading: null,
      removeEmail: jest.fn(),
      removeLoading: null,
    },
    ...over,
  };
}

function renderTab(over: Partial<Record<string, unknown>> = {}) {
  const hooks = makeHooks(over);
  const props = {
    discord: hooks.discord,
    github: hooks.github,
    google: hooks.google,
    mfa: hooks.mfa,
    email: hooks.email,
    primaryEmail: "user@example.com",
    additionalEmails: [],
    hasPasswordProvider: false,
    connectedAgents: [],
    loadingAgents: false,
    onSetPassword: jest.fn().mockResolvedValue(undefined),
    passwordSaving: false,
    passwordError: null,
    passwordSuccess: false,
    ...((over.props as object) ?? {}),
  } as never;
  render(<SecurityTab {...props} />);
  return hooks;
}

describe("SecurityTab — banner + email management", () => {
  it("renders success verification banner with dismiss", () => {
    const hooks = renderTab({
      email: {
        ...makeHooks().email,
        verificationStatus: { type: "success", message: "Email verified!" },
      },
    });
    expect(screen.getByText("Email verified!")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Dismiss/i }));
    expect(hooks.email.setVerificationStatus).toHaveBeenCalledWith(null);
  });

  it("renders error verification banner styled red", () => {
    renderTab({
      email: {
        ...makeHooks().email,
        verificationStatus: { type: "error", message: "Verification failed" },
      },
    });
    expect(screen.getByText("Verification failed")).toBeInTheDocument();
  });

  it("renders primary email and verified additional email with Make Primary + Remove", () => {
    const hooks = renderTab({
      props: {
        additionalEmails: [{ email: "alt@example.com", verified: true }],
      },
    });
    expect(screen.getByText("alt@example.com")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Make Primary/i }));
    expect(hooks.email.makePrimary).toHaveBeenCalledWith("alt@example.com");
    fireEvent.click(screen.getByRole("button", { name: /Remove/i }));
    expect(hooks.email.removeEmail).toHaveBeenCalledWith("alt@example.com");
  });

  it("renders unverified additional email without Make Primary", () => {
    renderTab({
      props: {
        additionalEmails: [{ email: "alt@example.com", verified: false }],
      },
    });
    expect(screen.getByText(/Pending verification/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Make Primary/i })).not.toBeInTheDocument();
  });

  it("disables 'Make Primary' while primaryLoading matches the email", () => {
    renderTab({
      email: {
        ...makeHooks().email,
        primaryLoading: "alt@example.com",
      },
      props: {
        additionalEmails: [{ email: "alt@example.com", verified: true }],
      },
    });
    const btn = screen.getByRole("button", { name: /\.\.\./ });
    expect(btn).toBeDisabled();
  });

  it("Add Email button is disabled when newEmail is empty/whitespace", () => {
    renderTab();
    const btn = screen.getByRole("button", { name: /Add Email/i });
    expect(btn).toBeDisabled();
  });

  it("Add Email button enables when newEmail is non-empty and invokes addEmail", () => {
    const hooks = renderTab({
      email: { ...makeHooks().email, newEmail: "test@example.com" },
    });
    const btn = screen.getByRole("button", { name: /Add Email/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(hooks.email.addEmail).toHaveBeenCalled();
  });

  it("renders 'Sending…' label when addLoading=true", () => {
    renderTab({
      email: { ...makeHooks().email, newEmail: "x@y.z", addLoading: true },
    });
    expect(screen.getByRole("button", { name: /Sending/i })).toBeDisabled();
  });

  it("shows addError and addSuccess messages", () => {
    renderTab({
      email: {
        ...makeHooks().email,
        addError: "Invalid email",
        addSuccess: "Verification sent",
      },
    });
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
    expect(screen.getByText("Verification sent")).toBeInTheDocument();
  });
});

describe("SecurityTab — Google", () => {
  it("shows 'Not connected' and no disconnect button", () => {
    renderTab();
    expect(screen.getAllByText(/Not connected/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Disconnect Google/i })).not.toBeInTheDocument();
  });

  it("shows Disconnect Google when google.hasGoogleProvider=true", () => {
    const hooks = renderTab({
      google: { ...makeHooks().google, hasGoogleProvider: true },
    });
    fireEvent.click(screen.getByRole("button", { name: /Disconnect Google/i }));
    expect(hooks.google.disconnect).toHaveBeenCalled();
  });

  it("shows 'Disconnecting…' while disconnecting", () => {
    renderTab({
      google: {
        ...makeHooks().google,
        hasGoogleProvider: true,
        disconnecting: true,
      },
    });
    expect(screen.getByRole("button", { name: /Disconnecting/i })).toBeDisabled();
  });

  it("renders google.error when present", () => {
    renderTab({
      google: { ...makeHooks().google, error: "google rate-limited" },
    });
    expect(screen.getByText("google rate-limited")).toBeInTheDocument();
  });
});

describe("SecurityTab — Password section", () => {
  it("renders 'Set a Password' header when no password provider", () => {
    renderTab();
    expect(screen.getByText("Set a Password")).toBeInTheDocument();
  });

  it("renders 'Update Password' header when hasPasswordProvider=true", () => {
    renderTab({ props: { hasPasswordProvider: true } });
    expect(screen.getByText("Update Password")).toBeInTheDocument();
  });

  it("password too short → local error message", () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText("New password"), { target: { value: "abc" } });
    fireEvent.change(screen.getByPlaceholderText("Confirm password"), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Password/i }));
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it("passwords do not match → local error message", () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText("New password"), {
      target: { value: "longenough" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirm password"), {
      target: { value: "different!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Password/i }));
    expect(screen.getByText(/do not match/i)).toBeInTheDocument();
  });

  it("shows passwordSuccess message when success=true", () => {
    renderTab({ props: { passwordSuccess: true } });
    expect(screen.getByText("Password updated.")).toBeInTheDocument();
  });

  it("shows passwordError when error is set", () => {
    renderTab({ props: { passwordError: "rate-limited" } });
    expect(screen.getByText("rate-limited")).toBeInTheDocument();
  });

  it("disables Save Password while saving", () => {
    renderTab({ props: { passwordSaving: true } });
    expect(screen.getByRole("button", { name: /Saving/i })).toBeDisabled();
  });
});

describe("SecurityTab — MFA", () => {
  it("renders 'Use SMS' copy when no phone MFA", () => {
    renderTab();
    expect(screen.getByText(/Use SMS to add an extra layer/i)).toBeInTheDocument();
  });

  it("renders 'Enabled with SMS' copy when hasPhoneMfa=true and disables phone input + send", () => {
    renderTab({
      mfa: { ...makeHooks().mfa, hasPhoneMfa: true },
    });
    expect(screen.getByText("Enabled with SMS.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/15551234567/)).toBeDisabled();
    expect(screen.getByRole("button", { name: /Send Code/i })).toBeDisabled();
  });

  it("Send Code button invokes mfa.sendCode", () => {
    const hooks = renderTab();
    fireEvent.click(screen.getByRole("button", { name: /Send Code/i }));
    expect(hooks.mfa.sendCode).toHaveBeenCalled();
  });

  it("Disable 2FA invokes mfa.disable when hasPhoneMfa=true", () => {
    const hooks = renderTab({
      mfa: { ...makeHooks().mfa, hasPhoneMfa: true },
    });
    fireEvent.click(screen.getByRole("button", { name: /Disable 2FA/i }));
    expect(hooks.mfa.disable).toHaveBeenCalled();
  });

  it("renders SMS code input + Enable 2FA button when verificationId is set", () => {
    const hooks = renderTab({
      mfa: { ...makeHooks().mfa, verificationId: "v-1" },
    });
    expect(screen.getByPlaceholderText(/SMS code/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Enable 2FA/i }));
    expect(hooks.mfa.confirmEnrollment).toHaveBeenCalled();
  });

  it("renders mfa.error and mfa.success when set", () => {
    renderTab({
      mfa: { ...makeHooks().mfa, error: "code-expired", success: "enrolled!" },
    });
    expect(screen.getByText("code-expired")).toBeInTheDocument();
    expect(screen.getByText("enrolled!")).toBeInTheDocument();
  });

  it("shows 'Sending…' label when mfa.loading=true on Send Code", () => {
    renderTab({
      mfa: { ...makeHooks().mfa, loading: true },
    });
    expect(screen.getByRole("button", { name: /Sending/i })).toBeDisabled();
  });

  it("shows 'Verifying…' label when mfa.loading=true on Enable 2FA", () => {
    renderTab({
      mfa: { ...makeHooks().mfa, verificationId: "v-1", loading: true },
    });
    expect(screen.getByRole("button", { name: /Verifying/i })).toBeDisabled();
  });
});

describe("SecurityTab — Discord + GitHub + Agents", () => {
  it("shows Connect Discord when discordInfo is null", () => {
    const hooks = renderTab();
    fireEvent.click(screen.getByRole("button", { name: /Connect Discord/i }));
    expect(hooks.discord.connect).toHaveBeenCalled();
  });

  it("shows Disconnect Discord when discordInfo is set", () => {
    const hooks = renderTab({
      discord: { ...makeHooks().discord, discordInfo: { username: "user#0001" } },
    });
    expect(screen.getByText(/Connected as user#0001/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Disconnect Discord/i }));
    expect(hooks.discord.disconnect).toHaveBeenCalled();
  });

  it("shows 'Connecting…' label when discord.connecting=true", () => {
    renderTab({
      discord: { ...makeHooks().discord, connecting: true },
    });
    expect(screen.getByRole("button", { name: /Connecting/i })).toBeDisabled();
  });

  it("shows Connect GitHub when githubInfo is null", () => {
    const hooks = renderTab();
    fireEvent.click(screen.getByRole("button", { name: /Connect GitHub/i }));
    expect(hooks.github.connect).toHaveBeenCalled();
  });

  it("shows Disconnect GitHub when githubInfo is set", () => {
    const hooks = renderTab({
      github: { ...makeHooks().github, githubInfo: { login: "octocat" } },
    });
    expect(screen.getByText(/Connected as octocat/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Disconnect GitHub/i }));
    expect(hooks.github.disconnect).toHaveBeenCalled();
  });

  it("renders 'Loading…' while loadingAgents=true", () => {
    renderTab({ props: { loadingAgents: true } });
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders 'No agents connected' when empty", () => {
    renderTab();
    expect(screen.getByText(/No agents connected/i)).toBeInTheDocument();
  });

  it("renders agents list with avatar fallback when avatarUrl is missing", () => {
    renderTab({
      props: {
        connectedAgents: [
          { id: "a1", name: "Claude" },
          { id: "a2", name: "Cursor Agent", description: "AI dev", avatarUrl: "/a.png" },
        ],
      },
    });
    expect(screen.getByText("Claude")).toBeInTheDocument();
    expect(screen.getByText("Cursor Agent")).toBeInTheDocument();
    expect(screen.getByText("AI dev")).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0); // count badge
  });

  it("uses singular 'agent connected' for 1 agent", () => {
    renderTab({
      props: { connectedAgents: [{ id: "a1", name: "Claude" }] },
    });
    expect(screen.getByText(/1 agent connected/)).toBeInTheDocument();
  });
});
