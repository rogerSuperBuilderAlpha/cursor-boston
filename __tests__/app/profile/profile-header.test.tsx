/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/(auth)/profile/_components/ProfileHeader.tsx`
 * (0% / 10 uncovered branches). Covers avatar edit click, display-name
 * fallback, public/private toggle (both states), missing creationTime
 * 'Unknown' fallback, Edit button click, sign-out (success + disabled
 * while in-flight + error display).
 */

import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("@/components/Avatar", () => ({
  __esModule: true,
  default: ({ name }: { name: string | null }) => <div data-testid="avatar">{name}</div>,
}));

jest.mock("@/components/icons", () => ({
  EyeIcon: () => <span>👁</span>,
  EyeOffIcon: () => <span>🙈</span>,
}));

const mockUseProfileContext = jest.fn();
jest.mock("@/app/(auth)/profile/_contexts/ProfileContext", () => ({
  useProfileContext: () => mockUseProfileContext(),
}));

import { ProfileHeader } from "@/app/(auth)/profile/_components/ProfileHeader";

function setCtx(over: Partial<Record<string, unknown>> = {}) {
  const togglePublic = jest.fn();
  const handleSignOut = jest.fn();
  mockUseProfileContext.mockReturnValue({
    user: {
      uid: "u1",
      displayName: "Test User",
      email: "u@test.com",
      photoURL: "/p.png",
      metadata: { creationTime: "2024-01-15T00:00:00.000Z" },
      ...((over.user as object) ?? {}),
    },
    profileSettings: {
      settings: { visibility: { isPublic: true } },
      togglePublic,
      ...((over.profileSettings as object) ?? {}),
    },
    handleSignOut,
    isSigningOut: false,
    signOutError: null,
    ...over,
  });
  return { togglePublic, handleSignOut };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ProfileHeader", () => {
  it("renders the display name and email", () => {
    setCtx();
    render(<ProfileHeader onEditProfile={jest.fn()} />);
    // Display name appears in both the avatar mock and the h1 — use getAllByText.
    expect(screen.getAllByText("Test User").length).toBeGreaterThan(0);
    expect(screen.getByText("u@test.com")).toBeInTheDocument();
  });

  it("falls back to 'Community Member' when displayName is missing", () => {
    setCtx({ user: { uid: "u1", displayName: null, email: "u@x", photoURL: null, metadata: {} } });
    render(<ProfileHeader onEditProfile={jest.fn()} />);
    expect(screen.getByText("Community Member")).toBeInTheDocument();
  });

  it("renders Public chip when isPublic=true and toggles it", () => {
    const { togglePublic } = setCtx();
    render(<ProfileHeader onEditProfile={jest.fn()} />);
    expect(screen.getByText(/Public/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Public/ }));
    expect(togglePublic).toHaveBeenCalledWith(false);
  });

  it("renders Private chip when isPublic=false and toggles it", () => {
    const togglePublicLocal = jest.fn();
    mockUseProfileContext.mockReturnValue({
      user: {
        uid: "u1",
        displayName: "Test User",
        email: "u@test.com",
        photoURL: "/p.png",
        metadata: { creationTime: "2024-01-15T00:00:00.000Z" },
      },
      profileSettings: {
        settings: { visibility: { isPublic: false } },
        togglePublic: togglePublicLocal,
      },
      handleSignOut: jest.fn(),
      isSigningOut: false,
      signOutError: null,
    });
    render(<ProfileHeader onEditProfile={jest.fn()} />);
    expect(screen.getByText(/Private/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Private/ }));
    expect(togglePublicLocal).toHaveBeenCalledWith(true);
  });

  it("formats creationTime as month + year", () => {
    setCtx();
    render(<ProfileHeader onEditProfile={jest.fn()} />);
    expect(screen.getByText(/Member since January 2024/)).toBeInTheDocument();
  });

  it("renders 'Unknown' when metadata.creationTime is missing", () => {
    setCtx({
      user: {
        uid: "u1",
        displayName: "X",
        email: "x@x",
        photoURL: null,
        metadata: {},
      },
    });
    render(<ProfileHeader onEditProfile={jest.fn()} />);
    expect(screen.getByText(/Member since Unknown/)).toBeInTheDocument();
  });

  it("avatar button invokes onEditProfile", () => {
    setCtx();
    const onEditProfile = jest.fn();
    render(<ProfileHeader onEditProfile={onEditProfile} />);
    fireEvent.click(screen.getByLabelText("Edit profile photo"));
    expect(onEditProfile).toHaveBeenCalled();
  });

  it("Edit button invokes onEditProfile", () => {
    setCtx();
    const onEditProfile = jest.fn();
    render(<ProfileHeader onEditProfile={onEditProfile} />);
    fireEvent.click(screen.getByRole("button", { name: /^Edit$/ }));
    expect(onEditProfile).toHaveBeenCalled();
  });

  it("Sign Out button invokes handleSignOut", () => {
    const { handleSignOut } = setCtx();
    render(<ProfileHeader onEditProfile={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Sign Out/ }));
    expect(handleSignOut).toHaveBeenCalled();
  });

  it("shows '...' label and disables Sign Out while in flight", () => {
    setCtx({ isSigningOut: true });
    render(<ProfileHeader onEditProfile={jest.fn()} />);
    const btn = screen.getByRole("button", { name: "..." });
    expect(btn).toBeDisabled();
  });

  it("renders signOutError when set", () => {
    setCtx({ signOutError: "network down" });
    render(<ProfileHeader onEditProfile={jest.fn()} />);
    expect(screen.getByText("network down")).toBeInTheDocument();
  });

  it("does NOT render error banner when signOutError is null", () => {
    setCtx();
    const { container } = render(<ProfileHeader onEditProfile={jest.fn()} />);
    expect(container.querySelector(".bg-red-500\\/10")).toBeNull();
  });
});
