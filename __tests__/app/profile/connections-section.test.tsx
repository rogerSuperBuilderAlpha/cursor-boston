/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/(auth)/profile/_components/ConnectionsSection.tsx`
 * (0% / 52 uncovered branches). Covers each connection card
 * (GitHub/Discord/Ludwitt/Cursor) connected-vs-not, connecting/disconnecting
 * label flips, connection error display, status-badge predicate branches
 * (agents singular/plural, eduBadge, .edu in additionalEmails,
 * hackASprint2026ShowcaseBadge, hackASprint2026ShowcaseAwards items).
 */

import "@/__tests__/app/_shared/page-test-setup";

import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("@/lib/hackathon-asprint-2026-awards", () => ({
  SHOWCASE_AWARD_LABEL: {
    grand: "Grand Prize",
    runner_up: "Runner Up",
  },
}));

const mockUseProfileContext = jest.fn();
jest.mock("@/app/(auth)/profile/_contexts/ProfileContext", () => ({
  useProfileContext: () => mockUseProfileContext(),
}));

import { ConnectionsSection } from "@/app/(auth)/profile/_components/ConnectionsSection";

function makeCtx(over: Partial<Record<string, unknown>> = {}) {
  return {
    userProfile: null,
    data: { connectedAgents: [] },
    discord: {
      discordInfo: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      connecting: false,
      disconnecting: false,
      error: null,
    },
    github: {
      githubInfo: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      connecting: false,
      disconnecting: false,
      error: null,
    },
    ludwitt: {
      ludwittInfo: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      connecting: false,
      disconnecting: false,
      error: null,
    },
    cursor: {
      cursorInfo: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      connecting: false,
      disconnecting: false,
      error: null,
    },
    ...over,
  };
}

function setCtx(over: Partial<Record<string, unknown>> = {}) {
  const ctx = makeCtx(over);
  mockUseProfileContext.mockReturnValue(ctx);
  return ctx;
}

beforeEach(() => jest.clearAllMocks());

describe("ConnectionsSection — GitHub", () => {
  it("renders 'Not connected' and Connect button when no githubInfo", () => {
    const ctx = setCtx();
    render(<ConnectionsSection />);
    const connectBtns = screen.getAllByRole("button", { name: /^Connect$/ });
    fireEvent.click(connectBtns[0]);
    expect(ctx.github.connect).toHaveBeenCalled();
  });

  it("renders login + Disconnect button when githubInfo set", () => {
    const ctx = setCtx({
      github: { ...makeCtx().github, githubInfo: { login: "octocat" } },
    });
    render(<ConnectionsSection />);
    expect(screen.getByText("octocat")).toBeInTheDocument();
    const disconnectBtns = screen.getAllByRole("button", { name: /^Disconnect$/ });
    fireEvent.click(disconnectBtns[0]);
    expect(ctx.github.disconnect).toHaveBeenCalled();
  });

  it("renders '...' label while connecting=true", () => {
    setCtx({
      github: { ...makeCtx().github, connecting: true },
    });
    render(<ConnectionsSection />);
    expect(screen.getAllByRole("button", { name: "..." }).length).toBeGreaterThan(0);
  });

  it("renders '...' label while disconnecting=true on connected GitHub", () => {
    setCtx({
      github: { ...makeCtx().github, githubInfo: { login: "x" }, disconnecting: true },
    });
    render(<ConnectionsSection />);
    expect(screen.getAllByRole("button", { name: "..." }).length).toBeGreaterThan(0);
  });
});

describe("ConnectionsSection — Discord", () => {
  it("renders Connect button + invokes discord.connect", () => {
    const ctx = setCtx();
    render(<ConnectionsSection />);
    const btns = screen.getAllByRole("button", { name: /^Connect$/ });
    fireEvent.click(btns[1]);
    expect(ctx.discord.connect).toHaveBeenCalled();
  });

  it("renders username + Disconnect when discordInfo set", () => {
    const ctx = setCtx({
      discord: { ...makeCtx().discord, discordInfo: { username: "user#0001" } },
    });
    render(<ConnectionsSection />);
    expect(screen.getByText("user#0001")).toBeInTheDocument();
    const btns = screen.getAllByRole("button", { name: /^Disconnect$/ });
    fireEvent.click(btns[0]);
    expect(ctx.discord.disconnect).toHaveBeenCalled();
  });
});

describe("ConnectionsSection — Ludwitt", () => {
  it("renders Connect button when no ludwittInfo", () => {
    const ctx = setCtx();
    render(<ConnectionsSection />);
    const btns = screen.getAllByRole("button", { name: /^Connect$/ });
    fireEvent.click(btns[2]);
    expect(ctx.ludwitt.connect).toHaveBeenCalled();
  });

  it("renders email when ludwittInfo.email is present", () => {
    setCtx({
      ludwitt: { ...makeCtx().ludwitt, ludwittInfo: { email: "lud@witt.com" } },
    });
    render(<ConnectionsSection />);
    expect(screen.getByText("lud@witt.com")).toBeInTheDocument();
  });

  it("falls back to name when no email", () => {
    setCtx({
      ludwitt: { ...makeCtx().ludwitt, ludwittInfo: { name: "Ludwitt User" } },
    });
    render(<ConnectionsSection />);
    expect(screen.getByText("Ludwitt User")).toBeInTheDocument();
  });

  it("falls back to 'Connected' when neither email nor name", () => {
    setCtx({
      ludwitt: { ...makeCtx().ludwitt, ludwittInfo: {} },
    });
    render(<ConnectionsSection />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("disconnect calls ludwitt.disconnect", () => {
    const ctx = setCtx({
      ludwitt: { ...makeCtx().ludwitt, ludwittInfo: { email: "x@y" } },
    });
    render(<ConnectionsSection />);
    const btns = screen.getAllByRole("button", { name: /^Disconnect$/ });
    fireEvent.click(btns[0]);
    expect(ctx.ludwitt.disconnect).toHaveBeenCalled();
  });
});

describe("ConnectionsSection — Cursor", () => {
  it("renders Connect button + invokes cursor.connect", () => {
    const ctx = setCtx();
    render(<ConnectionsSection />);
    const btns = screen.getAllByRole("button", { name: /^Connect$/ });
    fireEvent.click(btns[3]);
    expect(ctx.cursor.connect).toHaveBeenCalled();
  });

  it("renders apiKeyFingerprint when cursorInfo set", () => {
    setCtx({
      cursor: { ...makeCtx().cursor, cursorInfo: { apiKeyFingerprint: "abc123" } },
    });
    render(<ConnectionsSection />);
    expect(screen.getByText("abc123")).toBeInTheDocument();
  });

  it("disconnect calls cursor.disconnect", () => {
    const ctx = setCtx({
      cursor: { ...makeCtx().cursor, cursorInfo: { apiKeyFingerprint: "k" } },
    });
    render(<ConnectionsSection />);
    const btns = screen.getAllByRole("button", { name: /^Disconnect$/ });
    fireEvent.click(btns[0]);
    expect(ctx.cursor.disconnect).toHaveBeenCalled();
  });
});

describe("ConnectionsSection — Status badges", () => {
  it("renders no badges when nothing is satisfied", () => {
    setCtx();
    const { container } = render(<ConnectionsSection />);
    expect(container.textContent).not.toMatch(/Agent|verified|Hack-a-Sprint/);
  });

  it("renders singular '1 Agent' when connectedAgents.length === 1", () => {
    setCtx({ data: { connectedAgents: [{ id: "a" }] } });
    render(<ConnectionsSection />);
    expect(screen.getByText(/^1 Agent$/)).toBeInTheDocument();
  });

  it("renders plural 'N Agents' when connectedAgents.length > 1", () => {
    setCtx({ data: { connectedAgents: [{ id: "a" }, { id: "b" }] } });
    render(<ConnectionsSection />);
    expect(screen.getByText(/^2 Agents$/)).toBeInTheDocument();
  });

  it("renders '.edu verified' when eduBadge=true", () => {
    setCtx({ userProfile: { eduBadge: true } });
    render(<ConnectionsSection />);
    expect(screen.getByText(/\.edu verified/)).toBeInTheDocument();
  });

  it("renders '.edu verified' when additionalEmails includes verified .edu", () => {
    setCtx({
      userProfile: {
        additionalEmails: [{ email: "u@harvard.EDU", verified: true }],
      },
    });
    render(<ConnectionsSection />);
    expect(screen.getByText(/\.edu verified/)).toBeInTheDocument();
  });

  it("does NOT render .edu badge for unverified .edu email", () => {
    setCtx({
      userProfile: {
        additionalEmails: [{ email: "u@x.edu", verified: false }],
      },
    });
    const { container } = render(<ConnectionsSection />);
    expect(container.textContent).not.toMatch(/\.edu verified/);
  });

  it("renders Hack-a-Sprint badge when hackASprint2026ShowcaseBadge=true", () => {
    setCtx({ userProfile: { hackASprint2026ShowcaseBadge: true } });
    render(<ConnectionsSection />);
    expect(screen.getByText(/Hack-a-Sprint/)).toBeInTheDocument();
  });

  it("renders each award label from SHOWCASE_AWARD_LABEL map", () => {
    setCtx({
      userProfile: {
        hackASprint2026ShowcaseAwards: ["grand", "runner_up"],
      },
    });
    render(<ConnectionsSection />);
    expect(screen.getByText("Grand Prize")).toBeInTheDocument();
    expect(screen.getByText("Runner Up")).toBeInTheDocument();
  });
});

describe("ConnectionsSection — error display", () => {
  it("renders discord.error when set", () => {
    setCtx({ discord: { ...makeCtx().discord, error: "discord failed" } });
    render(<ConnectionsSection />);
    expect(screen.getByText("discord failed")).toBeInTheDocument();
  });

  it("falls through to github.error when discord.error is null", () => {
    setCtx({ github: { ...makeCtx().github, error: "github failed" } });
    render(<ConnectionsSection />);
    expect(screen.getByText("github failed")).toBeInTheDocument();
  });

  it("falls through to ludwitt.error when discord+github both null", () => {
    setCtx({ ludwitt: { ...makeCtx().ludwitt, error: "lw failed" } });
    render(<ConnectionsSection />);
    expect(screen.getByText("lw failed")).toBeInTheDocument();
  });

  it("falls through to cursor.error when all others null", () => {
    setCtx({ cursor: { ...makeCtx().cursor, error: "cursor failed" } });
    render(<ConnectionsSection />);
    expect(screen.getByText("cursor failed")).toBeInTheDocument();
  });
});
