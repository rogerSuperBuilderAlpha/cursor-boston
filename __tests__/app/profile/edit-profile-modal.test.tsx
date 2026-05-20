/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage — `app/(auth)/profile/_components/EditProfileModal.tsx`
 * (22% / 25 uncovered branches). Covers Escape close, Cancel close,
 * backdrop click close, name edit + Save happy path (trimmed name passed
 * to onSave), photo select valid image, photo select invalid type → error,
 * photo select oversize → error, onSave Error throw → error display,
 * non-Error throw → fallback message, focus trap Tab + Shift+Tab.
 */

import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, src, ...rest }: { alt: string; src: string }) => (
    <img alt={alt} src={src} {...rest} />
  ),
}));

jest.mock("@/components/Avatar", () => ({
  __esModule: true,
  default: ({ name }: { name: string | null }) => <div data-testid="avatar">{name}</div>,
}));

jest.mock("@/components/ui/FormField", () => ({
  FormInput: ({ id, label, value, onChange, placeholder }: {
    id: string;
    label?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
  }) => (
    <label>
      {label && <span>{label}</span>}
      <input id={id} value={value} onChange={onChange} placeholder={placeholder} />
    </label>
  ),
}));

jest.mock("@/components/icons", () => ({
  CloseIcon: () => <span>×</span>,
}));

import { EditProfileModal } from "@/app/(auth)/profile/_components/EditProfileModal";

const baseUser = {
  uid: "u1",
  displayName: "Test User",
  email: "user@example.com",
  photoURL: "/avatar.png",
} as never;

beforeEach(() => {
  jest.clearAllMocks();
  // Stub URL.createObjectURL for jsdom
  Object.defineProperty(globalThis.URL, "createObjectURL", {
    writable: true,
    value: jest.fn(() => "blob:fake"),
  });
});

describe("EditProfileModal", () => {
  it("pre-fills the display name from user.displayName", () => {
    render(<EditProfileModal user={baseUser} onSave={jest.fn()} onClose={jest.fn()} />);
    expect((screen.getByPlaceholderText("Your name") as HTMLInputElement).value).toBe("Test User");
  });

  it("invokes onClose when the X (close) button is clicked", () => {
    const onClose = jest.fn();
    render(<EditProfileModal user={baseUser} onSave={jest.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("invokes onClose when Cancel is clicked", () => {
    const onClose = jest.fn();
    render(<EditProfileModal user={baseUser} onSave={jest.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("invokes onClose when the backdrop is clicked", () => {
    const onClose = jest.fn();
    const { container } = render(
      <EditProfileModal user={baseUser} onSave={jest.fn()} onClose={onClose} />
    );
    const backdrop = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("invokes onClose when Escape is pressed", () => {
    const onClose = jest.fn();
    render(<EditProfileModal user={baseUser} onSave={jest.fn()} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onSave with trimmed name then onClose on Save", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    render(<EditProfileModal user={baseUser} onSave={onSave} onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "  New Name  " },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));
    });
    expect(onSave).toHaveBeenCalledWith("New Name", undefined);
    expect(onClose).toHaveBeenCalled();
  });

  it("displays error when onSave throws an Error", async () => {
    const onSave = jest.fn().mockRejectedValue(new Error("network down"));
    render(<EditProfileModal user={baseUser} onSave={onSave} onClose={jest.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));
    });
    expect(screen.getByText("network down")).toBeInTheDocument();
  });

  it("falls back to default message on non-Error throw", async () => {
    const onSave = jest.fn().mockRejectedValue("string error");
    render(<EditProfileModal user={baseUser} onSave={onSave} onClose={jest.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));
    });
    expect(screen.getByText(/Failed to update profile/i)).toBeInTheDocument();
  });

  it("rejects non-image photo files with an error message", () => {
    render(<EditProfileModal user={baseUser} onSave={jest.fn()} onClose={jest.fn()} />);
    const input = document.getElementById("photo-upload") as HTMLInputElement;
    const file = new File(["txt"], "doc.txt", { type: "text/plain" });
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    expect(screen.getByText(/Please select an image file/)).toBeInTheDocument();
  });

  it("rejects oversize photos (>5MB) with an error message", () => {
    render(<EditProfileModal user={baseUser} onSave={jest.fn()} onClose={jest.fn()} />);
    const input = document.getElementById("photo-upload") as HTMLInputElement;
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "big.png", {
      type: "image/png",
    });
    Object.defineProperty(input, "files", { value: [big] });
    fireEvent.change(input);
    expect(screen.getByText(/less than 5MB/)).toBeInTheDocument();
  });

  it("accepts a valid image file and creates a preview", () => {
    render(<EditProfileModal user={baseUser} onSave={jest.fn()} onClose={jest.fn()} />);
    const input = document.getElementById("photo-upload") as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], "ok.png", {
      type: "image/png",
    });
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(screen.getByAltText("Preview")).toBeInTheDocument();
  });

  it("photo-select with no file is a no-op", () => {
    render(<EditProfileModal user={baseUser} onSave={jest.fn()} onClose={jest.fn()} />);
    const input = document.getElementById("photo-upload") as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [] });
    fireEvent.change(input);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("falls back to empty string when user.displayName is null", () => {
    render(
      <EditProfileModal
        user={{ ...baseUser, displayName: null } as never}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect((screen.getByPlaceholderText("Your name") as HTMLInputElement).value).toBe("");
  });

  it("disables Save button while isSaving=true (and shows 'Saving...' label)", async () => {
    let resolveSave: () => void = () => undefined;
    const onSave = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
    );
    render(<EditProfileModal user={baseUser} onSave={onSave} onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));
    expect(await screen.findByRole("button", { name: /Saving/i })).toBeDisabled();
    await act(async () => {
      resolveSave();
    });
  });

  it("Choose Photo button triggers the file input click", () => {
    render(<EditProfileModal user={baseUser} onSave={jest.fn()} onClose={jest.fn()} />);
    const input = document.getElementById("photo-upload") as HTMLInputElement;
    const clickSpy = jest.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: /Choose Photo/i }));
    expect(clickSpy).toHaveBeenCalled();
  });

  describe("focus trap (Tab / Shift+Tab wrap)", () => {
    function getFocusable(): HTMLElement[] {
      const modal = document.querySelector(
        '[aria-modal="true"] > div.relative'
      ) as HTMLElement;
      return Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );
    }

    it("Shift+Tab on the first focusable element wraps focus to the last one", () => {
      render(<EditProfileModal user={baseUser} onSave={jest.fn()} onClose={jest.fn()} />);
      const focusable = getFocusable();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      first.focus();
      expect(document.activeElement).toBe(first);
      const lastFocusSpy = jest.spyOn(last, "focus");
      const dialog = screen.getByRole("dialog");
      fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
      expect(lastFocusSpy).toHaveBeenCalled();
    });

    it("Tab (no shift) on the last focusable element wraps focus to the first one", () => {
      render(<EditProfileModal user={baseUser} onSave={jest.fn()} onClose={jest.fn()} />);
      const focusable = getFocusable();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      last.focus();
      expect(document.activeElement).toBe(last);
      const firstFocusSpy = jest.spyOn(first, "focus");
      const dialog = screen.getByRole("dialog");
      fireEvent.keyDown(dialog, { key: "Tab" });
      expect(firstFocusSpy).toHaveBeenCalled();
    });

    it("Tab when focus is on a middle element is a no-op (does not wrap)", () => {
      render(<EditProfileModal user={baseUser} onSave={jest.fn()} onClose={jest.fn()} />);
      const focusable = getFocusable();
      // Need at least 3 focusable elements for a "middle" one to exist
      expect(focusable.length).toBeGreaterThanOrEqual(3);
      const middle = focusable[1];
      middle.focus();
      const firstSpy = jest.spyOn(focusable[0], "focus");
      const lastSpy = jest.spyOn(focusable[focusable.length - 1], "focus");
      const dialog = screen.getByRole("dialog");
      fireEvent.keyDown(dialog, { key: "Tab" });
      fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
      // Neither boundary should have been forced
      expect(firstSpy).not.toHaveBeenCalled();
      expect(lastSpy).not.toHaveBeenCalled();
    });

    it("non-Tab/Escape keys are ignored by the trap (e.g. ArrowDown)", () => {
      const onClose = jest.fn();
      render(<EditProfileModal user={baseUser} onSave={jest.fn()} onClose={onClose} />);
      const dialog = screen.getByRole("dialog");
      fireEvent.keyDown(dialog, { key: "ArrowDown" });
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
