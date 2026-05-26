/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/game/_components/dashboard/CreatePlayerGate.tsx`
 * (0% / 8 uncovered branches) and `app/certificate/_components/CertificateProgress.tsx`
 * (0% / 9 uncovered branches). Two small components consolidated into
 * one PR.
 */

import { fireEvent, render, screen } from "@testing-library/react";

import { CreatePlayerGate } from "@/app/game/_components/dashboard/CreatePlayerGate";
import { CertificateProgress } from "@/app/certificate/_components/CertificateProgress";

jest.mock("@/lib/certificate", () => ({
  CERTIFICATE_PR_THRESHOLD: 5,
}));

describe("CreatePlayerGate", () => {
  it("renders heading + form", () => {
    render(<CreatePlayerGate creating={false} error={null} onCreate={jest.fn()} />);
    expect(screen.getByText(/Begin your campaign/)).toBeInTheDocument();
  });

  it("submit button disabled when name is empty", () => {
    render(<CreatePlayerGate creating={false} error={null} onCreate={jest.fn()} />);
    expect(screen.getByRole("button", { name: /Enlist/i })).toBeDisabled();
  });

  it("submit button disabled when name is < 3 chars", () => {
    render(<CreatePlayerGate creating={false} error={null} onCreate={jest.fn()} />);
    const input = screen.getByPlaceholderText(/Captain Ash/);
    fireEvent.change(input, { target: { value: "ab" } });
    expect(screen.getByRole("button", { name: /Enlist/i })).toBeDisabled();
  });

  it("submit button enabled when name is 3+ chars and not creating", () => {
    render(<CreatePlayerGate creating={false} error={null} onCreate={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Captain Ash/), {
      target: { value: "Aragorn" },
    });
    expect(screen.getByRole("button", { name: /Enlist/i })).not.toBeDisabled();
  });

  it("submit button disabled while creating=true", () => {
    render(<CreatePlayerGate creating={true} error={null} onCreate={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Captain Ash/), {
      target: { value: "Aragorn" },
    });
    expect(screen.getByRole("button", { name: /Spawning/i })).toBeDisabled();
  });

  it("shows 'Spawning…' label when creating=true", () => {
    render(<CreatePlayerGate creating={true} error={null} onCreate={jest.fn()} />);
    expect(screen.getByText("Spawning…")).toBeInTheDocument();
  });

  it("invokes onCreate with trimmed name on form submit", () => {
    const onCreate = jest.fn();
    render(<CreatePlayerGate creating={false} error={null} onCreate={onCreate} />);
    const input = screen.getByPlaceholderText(/Captain Ash/);
    fireEvent.change(input, { target: { value: "  General X  " } });
    const form = input.closest("form")!;
    fireEvent.submit(form);
    expect(onCreate).toHaveBeenCalledWith("General X");
  });

  it("invokes onCreate on Enlist button click", () => {
    const onCreate = jest.fn();
    render(<CreatePlayerGate creating={false} error={null} onCreate={onCreate} />);
    fireEvent.change(screen.getByPlaceholderText(/Captain Ash/), {
      target: { value: "Mordor" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enlist/i }));
    expect(onCreate).toHaveBeenCalledWith("Mordor");
  });

  it("does NOT submit on form submit when canSubmit=false", () => {
    const onCreate = jest.fn();
    render(<CreatePlayerGate creating={false} error={null} onCreate={onCreate} />);
    const input = screen.getByPlaceholderText(/Captain Ash/);
    const form = input.closest("form")!;
    fireEvent.submit(form);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("renders error when set", () => {
    render(<CreatePlayerGate creating={false} error="name taken" onCreate={jest.fn()} />);
    expect(screen.getByText("name taken")).toBeInTheDocument();
  });
});

describe("CertificateProgress", () => {
  it("renders 'Locked' heading + lock icon when compact=false (default)", () => {
    render(<CertificateProgress pullRequestsCount={2} />);
    expect(screen.getByText(/Locked/)).toBeInTheDocument();
    expect(screen.getByText("🔒")).toBeInTheDocument();
  });

  it("renders 'Open Source Contributor' heading without lock when compact=true", () => {
    render(<CertificateProgress pullRequestsCount={2} compact />);
    expect(screen.getByText("Open Source Contributor")).toBeInTheDocument();
    expect(screen.queryByText("🔒")).not.toBeInTheDocument();
  });

  it("renders 'Merge N more PRs' plural copy when remaining > 1", () => {
    render(<CertificateProgress pullRequestsCount={1} />);
    expect(screen.getByText(/Merge 4 more PRs/)).toBeInTheDocument();
  });

  it("renders 'Merge 1 more PR' singular copy when remaining === 1", () => {
    render(<CertificateProgress pullRequestsCount={4} />);
    expect(screen.getByText(/Merge 1 more PR\b/)).toBeInTheDocument();
  });

  it("caps percentage at 100% when pullRequestsCount exceeds threshold", () => {
    const { container } = render(<CertificateProgress pullRequestsCount={10} />);
    const bar = container.querySelector(".bg-emerald-500") as HTMLElement;
    expect(bar.style.width).toBe("100%");
  });

  it("renders progress display with current/total counts", () => {
    render(<CertificateProgress pullRequestsCount={3} />);
    expect(screen.getByText(/3 \/ 5 merged PRs/)).toBeInTheDocument();
  });

  it("renders the contributor description with GitHub link", () => {
    render(<CertificateProgress pullRequestsCount={2} />);
    expect(screen.getByRole("link", { name: /Cursor Boston repository/ })).toBeInTheDocument();
  });
});
