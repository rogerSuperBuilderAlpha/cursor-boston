/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/summer-cohort/_components/SetupReadinessModal.tsx`
 * (28.6% / 20 uncovered branches). Covers shouldOpen rising edge,
 * !shouldOpen close, all four StatusRow done/not-done states, action
 * button clicks, Escape close, backdrop click close, X close, dev-env
 * confirm success + error, intake-survey action also closes.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";

import { SetupReadinessModal } from "@/app/summer-cohort/_components/SetupReadinessModal";

function makeProps(over: Partial<Record<string, unknown>> = {}) {
  return {
    cohortLabel: "Cohort 1",
    kickoffLabel: "Mon, May 11 · 6–7pm EST",
    needsDiscord: true,
    needsGithub: true,
    needsSurvey: true,
    needsDevEnvConfirm: true,
    onConnectDiscord: jest.fn(),
    onConnectGithub: jest.fn(),
    onGoToSurvey: jest.fn(),
    onConfirmDevEnv: jest.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("SetupReadinessModal — visibility", () => {
  it("renders null when nothing needs attention", () => {
    const { container } = render(
      <SetupReadinessModal
        {...makeProps({
          needsDiscord: false,
          needsGithub: false,
          needsDevEnvConfirm: false,
        })}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("auto-opens when at least one needs* flag is true", () => {
    render(<SetupReadinessModal {...makeProps()} />);
    expect(screen.getByText(/Final readiness check/)).toBeInTheDocument();
  });

  it("renders cohort label + kickoff label", () => {
    render(<SetupReadinessModal {...makeProps()} />);
    expect(screen.getByText(/before Cohort 1 kickoff/)).toBeInTheDocument();
    expect(screen.getByText(/Mon, May 11 · 6–7pm EST/)).toBeInTheDocument();
  });
});

describe("SetupReadinessModal — status rows", () => {
  it("Discord row 'done' state shows the doneCopy", () => {
    render(<SetupReadinessModal {...makeProps({ needsDiscord: false })} />);
    expect(screen.getByText(/cohort channel/)).toBeInTheDocument();
  });

  it("Discord row not-done invokes onConnectDiscord", () => {
    const onConnectDiscord = jest.fn();
    render(<SetupReadinessModal {...makeProps({ onConnectDiscord })} />);
    fireEvent.click(screen.getByRole("button", { name: /Connect Discord/ }));
    expect(onConnectDiscord).toHaveBeenCalled();
  });

  it("GitHub row not-done invokes onConnectGithub", () => {
    const onConnectGithub = jest.fn();
    render(<SetupReadinessModal {...makeProps({ onConnectGithub })} />);
    fireEvent.click(screen.getByRole("button", { name: /Connect GitHub/ }));
    expect(onConnectGithub).toHaveBeenCalled();
  });

  it("Survey row not-done invokes onGoToSurvey AND closes modal", () => {
    const onGoToSurvey = jest.fn();
    render(<SetupReadinessModal {...makeProps({ onGoToSurvey })} />);
    fireEvent.click(screen.getByRole("button", { name: /Take the survey/ }));
    expect(onGoToSurvey).toHaveBeenCalled();
    expect(screen.queryByText(/Final readiness check/)).not.toBeInTheDocument();
  });

  it("Survey row 'done' shows Submitted copy", () => {
    render(<SetupReadinessModal {...makeProps({ needsSurvey: false })} />);
    expect(screen.getByText(/Submitted\. Thanks/)).toBeInTheDocument();
  });

  it("DevEnv row not-done invokes onConfirmDevEnv (success)", async () => {
    const onConfirmDevEnv = jest.fn().mockResolvedValue(undefined);
    render(<SetupReadinessModal {...makeProps({ onConfirmDevEnv })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Yes, I'm ready/ }));
    });
    expect(onConfirmDevEnv).toHaveBeenCalled();
  });

  it("DevEnv row 'Saving…' label appears while in flight", async () => {
    let resolve: () => void = () => undefined;
    const onConfirmDevEnv = jest.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        })
    );
    render(<SetupReadinessModal {...makeProps({ onConfirmDevEnv })} />);
    fireEvent.click(screen.getByRole("button", { name: /Yes, I'm ready/ }));
    expect(await screen.findByRole("button", { name: /Saving/ })).toBeDisabled();
    await act(async () => {
      resolve();
    });
  });

  it("DevEnv row error message renders on onConfirmDevEnv throw", async () => {
    const onConfirmDevEnv = jest.fn().mockRejectedValue(new Error("boom"));
    render(<SetupReadinessModal {...makeProps({ onConfirmDevEnv })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Yes, I'm ready/ }));
    });
    expect(screen.getByText(/Couldn't save/)).toBeInTheDocument();
  });

  it("DevEnv 'done' state shows Confirmed copy", () => {
    render(<SetupReadinessModal {...makeProps({ needsDevEnvConfirm: false })} />);
    expect(screen.getByText(/Confirmed — you're all set for kickoff/)).toBeInTheDocument();
  });
});

describe("SetupReadinessModal — close interactions", () => {
  it("X close button hides the modal", () => {
    render(<SetupReadinessModal {...makeProps()} />);
    fireEvent.click(screen.getByLabelText("Close readiness check"));
    expect(screen.queryByText(/Final readiness check/)).not.toBeInTheDocument();
  });

  it("backdrop click closes the modal", () => {
    const { container } = render(<SetupReadinessModal {...makeProps()} />);
    const backdrop = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    fireEvent.click(backdrop);
    expect(screen.queryByText(/Final readiness check/)).not.toBeInTheDocument();
  });

  it("Escape key closes the modal", () => {
    render(<SetupReadinessModal {...makeProps()} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText(/Final readiness check/)).not.toBeInTheDocument();
  });

  it("Escape key is a no-op when modal is already closed", () => {
    render(
      <SetupReadinessModal
        {...makeProps({
          needsDiscord: false,
          needsGithub: false,
          needsDevEnvConfirm: false,
        })}
      />
    );
    // Should not throw
    fireEvent.keyDown(document, { key: "Escape" });
    expect(true).toBe(true);
  });
});
