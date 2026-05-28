/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * @jest-environment jsdom
 */

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SportsHackConfirmAttendanceModal } from "@/components/hackathons/SportsHackConfirmAttendanceModal";
import { useAuth } from "@/contexts/AuthContext";
import { usePathname } from "next/navigation";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/"),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
    className?: string;
  }) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

function setAuth(
  signedIn: boolean,
  opts: { loading?: boolean } = {}
) {
  mockUseAuth.mockReturnValue({
    user: signedIn
      ? ({ uid: "u1", getIdToken: async () => "fake-token" } as never)
      : null,
    loading: opts.loading ?? false,
  } as never);
}

function setSignupResponse(
  fetchMock: jest.Mock,
  body: { signedUp: boolean; attendingConfirmed?: boolean }
) {
  fetchMock.mockImplementationOnce(async () => ({
    ok: true,
    json: async () => ({ me: body }),
  }));
}

describe("SportsHackConfirmAttendanceModal", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-24T12:00:00Z"));
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    window.sessionStorage.clear();
    mockUsePathname.mockReturnValue("/");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders nothing when the user is not signed in", () => {
    setAuth(false);
    render(<SportsHackConfirmAttendanceModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders nothing while auth is still loading", () => {
    setAuth(true, { loading: true });
    render(<SportsHackConfirmAttendanceModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing when pathname starts with /hackathons/sports-hack-2026", async () => {
    setAuth(true);
    mockUsePathname.mockReturnValue("/hackathons/sports-hack-2026/signup");
    render(<SportsHackConfirmAttendanceModal />);
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing if sessionStorage flag is set", async () => {
    window.sessionStorage.setItem("sports-hack-2026-confirm-dismissed", "1");
    setAuth(true);
    render(<SportsHackConfirmAttendanceModal />);
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing when event date has passed", async () => {
    jest.setSystemTime(new Date("2026-05-28T00:00:00Z"));
    setAuth(true);
    render(<SportsHackConfirmAttendanceModal />);
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing when me.signedUp is false", async () => {
    setAuth(true);
    setSignupResponse(fetchMock, { signedUp: false });
    render(<SportsHackConfirmAttendanceModal />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing when already attendingConfirmed", async () => {
    setAuth(true);
    setSignupResponse(fetchMock, { signedUp: true, attendingConfirmed: true });
    render(<SportsHackConfirmAttendanceModal />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders modal when signed up but not confirmed", async () => {
    setAuth(true);
    setSignupResponse(fetchMock, { signedUp: true, attendingConfirmed: false });
    render(<SportsHackConfirmAttendanceModal />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm I'll attend/i })).toBeInTheDocument();
  });

  it("calls POST /confirm-attendance on Confirm click and hides modal on success", async () => {
    setAuth(true);
    setSignupResponse(fetchMock, { signedUp: true, attendingConfirmed: false });
    fetchMock.mockImplementationOnce(async () => ({ ok: true, json: async () => ({ ok: true }) }));

    render(<SportsHackConfirmAttendanceModal />);
    const confirmButton = await screen.findByRole("button", {
      name: /Confirm I'll attend/i,
    });

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    expect(fetchMock.mock.calls[1][0]).toContain("/confirm-attendance");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("dismisses + writes sessionStorage flag on X click", async () => {
    setAuth(true);
    setSignupResponse(fetchMock, { signedUp: true, attendingConfirmed: false });

    render(<SportsHackConfirmAttendanceModal />);
    const dismissButton = await screen.findByRole("button", { name: /Dismiss/i });

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await act(async () => {
      await user.click(dismissButton);
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(window.sessionStorage.getItem("sports-hack-2026-confirm-dismissed")).toBe("1");
  });
});
