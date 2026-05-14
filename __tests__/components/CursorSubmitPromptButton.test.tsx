/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CursorSubmitPromptButton } from "@/components/events/CursorSubmitPromptButton";

describe("CursorSubmitPromptButton", () => {
  let writeText: jest.Mock;

  beforeEach(() => {
    writeText = jest.fn().mockResolvedValue(undefined);
    // jsdom may or may not expose navigator.clipboard depending on the build;
    // overwrite the whole `clipboard` slot so the component sees our mock either way.
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
  });

  it("renders the copy + preview buttons (preview hidden by default)", () => {
    render(<CursorSubmitPromptButton />);
    expect(
      screen.getByRole("button", { name: /copy cursor prompt/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /preview prompt/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /hide preview/i })).toBeNull();
  });

  it("toggles the preview pane and shows the prompt body", async () => {
    const user = userEvent.setup();
    render(<CursorSubmitPromptButton />);
    await user.click(screen.getByRole("button", { name: /preview prompt/i }));
    // Distinctive phrase from the prompt body — confirms the visible text is the prompt
    expect(
      screen.getByText(/Cursor Boston × PyData hackathon at Moderna HQ/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /hide preview/i })
    ).toBeInTheDocument();
  });

  it("writes the prompt to the clipboard on copy click + flips label to Copied", async () => {
    render(<CursorSubmitPromptButton />);
    // fireEvent rather than userEvent — user-event v14 ships its own clipboard
    // simulation that intercepts navigator.clipboard.writeText, which would
    // hide the call from our mock spy.
    fireEvent.click(screen.getByRole("button", { name: /copy cursor prompt/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0][0];
    expect(typeof copied).toBe("string");
    expect(copied).toMatch(/pydata-2026-submissions/);
    expect(copied).toMatch(/rogerSuperBuilderAlpha\/cursor-boston/);
    expect(
      await screen.findByRole("button", { name: /copied/i })
    ).toBeInTheDocument();
  });

  it("falls back to opening the preview + showing an error when clipboard write rejects", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(<CursorSubmitPromptButton />);
    fireEvent.click(screen.getByRole("button", { name: /copy cursor prompt/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /couldn't write to clipboard/i
      )
    );
    // Preview pane is opened so the user can copy manually
    expect(
      screen.getByText(/Cursor Boston × PyData hackathon at Moderna HQ/i)
    ).toBeInTheDocument();
  });
});
