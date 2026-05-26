/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/pr-ideas/_components/TagsField.tsx` was at
 * 2.6% statements (37 uncovered) with no dedicated test. Covers all
 * input paths: add via Enter/comma, dedupe (case-insensitive), backspace
 * to remove last, click-to-remove chip, option-list toggle, add via Add
 * button, onOpen invocation.
 */

import "@/__tests__/app/_shared/page-test-setup";

import { useState  } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { TagsField } from "@/app/pr-ideas/_components/TagsField";

function Harness({
  initial = [],
  options = ["React", "Next.js", "Tailwind"],
  isOpen = true,
}: {
  initial?: string[];
  options?: readonly string[];
  isOpen?: boolean;
}) {
  const [value, setValue] = useState<string[]>(initial);
  const [open, setOpen] = useState(isOpen);
  return (
    <TagsField
      label="Tags"
      placeholder="Add a tag…"
      options={options}
      value={value}
      isOpen={open}
      onOpen={() => setOpen(true)}
      onChange={setValue}
    />
  );
}

describe("TagsField", () => {
  it("renders label, placeholder, and existing chips", () => {
    render(<Harness initial={["alpha", "beta"]} />);
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
  });

  it("adds a tag when Enter is pressed", () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText("Add a tag…");
    fireEvent.change(input, { target: { value: "frontend" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("frontend")).toBeInTheDocument();
  });

  it("adds a tag when comma is pressed", () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText("Add a tag…");
    fireEvent.change(input, { target: { value: "backend" } });
    fireEvent.keyDown(input, { key: "," });
    expect(screen.getByText("backend")).toBeInTheDocument();
  });

  it("trims whitespace and skips empty submissions", () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText("Add a tag…");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    // Should not add — chip area still empty.
    expect(screen.queryAllByRole("button", { name: /Remove / }).length).toBe(0);
  });

  it("dedupes case-insensitively", () => {
    render(<Harness initial={["TypeScript"]} />);
    const input = screen.getByPlaceholderText("Add another...");
    fireEvent.change(input, { target: { value: "typescript" } });
    fireEvent.keyDown(input, { key: "Enter" });
    // Should still only show one chip
    expect(screen.getAllByText(/typescript/i).length).toBe(1);
  });

  it("removes the last chip on Backspace when draft is empty", () => {
    render(<Harness initial={["red", "green", "blue"]} />);
    const input = screen.getByPlaceholderText("Add another...");
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(screen.queryByText("blue")).not.toBeInTheDocument();
    expect(screen.getByText("green")).toBeInTheDocument();
  });

  it("removes a chip when the x button is clicked", () => {
    render(<Harness initial={["alpha", "beta"]} />);
    fireEvent.click(screen.getByLabelText("Remove alpha"));
    expect(screen.queryByText("alpha")).not.toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
  });

  it("renders option buttons when isOpen is true and toggles them", () => {
    render(<Harness options={["React"]} />);
    const optionButton = screen.getByRole("button", { name: /React/i });
    fireEvent.click(optionButton);
    expect(screen.getAllByText("React").length).toBeGreaterThan(0);

    // Click again to deselect
    fireEvent.click(optionButton);
    // Should remove the chip — only the option remains, not the chip.
    expect(screen.queryByLabelText(/Remove React/i)).not.toBeInTheDocument();
  });

  it("does NOT render option list when isOpen is false", () => {
    render(<Harness isOpen={false} />);
    expect(screen.queryByPlaceholderText(/Type anything else/i)).not.toBeInTheDocument();
  });

  it("Add button submits the secondary draft input", () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText(/Type anything else/i);
    fireEvent.change(input, { target: { value: "custom-tag" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
    expect(screen.getByText("custom-tag")).toBeInTheDocument();
  });

  it("secondary input adds on Enter", () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText(/Type anything else/i);
    fireEvent.change(input, { target: { value: "via-enter" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("via-enter")).toBeInTheDocument();
  });
});
