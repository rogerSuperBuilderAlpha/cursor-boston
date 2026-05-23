/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SportsHackSubmitPromptButton } from "@/components/events/SportsHackSubmitPromptButton";

describe("SportsHackSubmitPromptButton", () => {
  let writeText: jest.Mock;

  beforeEach(() => {
    writeText = jest.fn().mockResolvedValue(undefined);
    // Override clipboard via defineProperty (Object.assign won't work — slot is read-only in jsdom).
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
  });

  it("renders the headline + copy + preview buttons", () => {
    render(<SportsHackSubmitPromptButton />);
    expect(screen.getByText(/Let your agent submit for you/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy agent prompt/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Preview prompt/ })).toBeInTheDocument();
  });

  it("toggles the inline preview block on Preview prompt", async () => {
    const user = userEvent.setup();
    render(<SportsHackSubmitPromptButton />);
    expect(screen.queryByText(/Hard deadline/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Preview prompt/ }));
    expect(screen.getByText(/Hard deadline/)).toBeInTheDocument();
  });

  it("copies the prompt to the clipboard with the event branch + deadline + handle detection", async () => {
    render(<SportsHackSubmitPromptButton />);
    // fireEvent rather than userEvent — user-event v14 ships its own clipboard
    // simulation that would intercept navigator.clipboard.writeText.
    fireEvent.click(screen.getByRole("button", { name: /Copy agent prompt/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0][0];
    expect(typeof copied).toBe("string");
    expect(copied).toMatch(/sports-hack-2026-submissions/);
    expect(copied).toMatch(/2026-05-26T20:00:00Z/);
    expect(copied).toMatch(/meta\.json/);
    expect(copied).toMatch(/gh api user --jq \.login/);
    expect(copied).toMatch(/rogerSuperBuilderAlpha\/cursor-boston/);
    expect(await screen.findByRole("button", { name: /Copied/ })).toBeInTheDocument();
  });

  it("falls back to the inline preview + error message when clipboard fails", async () => {
    writeText.mockRejectedValue(new Error("Clipboard blocked"));
    render(<SportsHackSubmitPromptButton />);
    fireEvent.click(screen.getByRole("button", { name: /Copy agent prompt/ }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /Couldn't write to clipboard/i,
      ),
    );
    // Inline preview auto-opens so the user can copy manually.
    expect(screen.getByText(/Hard deadline/)).toBeInTheDocument();
  });
});
