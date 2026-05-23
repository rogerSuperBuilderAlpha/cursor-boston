/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { CLASS_GROUPS, TAILWIND_CLASS_NAMES as TW } from "@/lib/classname-constants";
import { cn } from "@/lib/utils";

const inputClass = CLASS_GROUPS.form.inputDark;
const labelClass = CLASS_GROUPS.form.labelDark;

// ── FormInput ────────────────────────────────────────────────────────────────

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Field label rendered above the input */
  label?: string;
  id: string;
  /** Red error text rendered below the input */
  error?: string | null;
}

export function FormInput({ label, id, error, ...props }: FormInputProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      {label && (
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
      )}
      <input id={id} className={inputClass} aria-describedby={errorId} {...props} />
      {error && <p id={errorId} role="alert" className={CLASS_GROUPS.form.errorText}>{error}</p>}
    </div>
  );
}

// ── FormTextarea ─────────────────────────────────────────────────────────────

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  id: string;
  error?: string | null;
}

export function FormTextarea({ label, id, error, rows = 3, ...props }: FormTextareaProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      {label && (
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={cn(inputClass, "resize-none")}
        aria-describedby={errorId}
        rows={rows}
        {...props}
      />
      {error && <p id={errorId} role="alert" className={CLASS_GROUPS.form.errorText}>{error}</p>}
    </div>
  );
}

// ── ToggleSwitch ─────────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** "sm" = small (w-9 h-5), "md" = medium (w-11 h-6). Defaults to "sm". */
  size?: "sm" | "md";
  /** Accessible label for screen readers */
  label?: string;
  disabled?: boolean;
}

export function ToggleSwitch({
  checked,
  onChange,
  size = "sm",
  label,
  disabled = false,
}: ToggleSwitchProps) {
  const trackSizeClass =
    size === "md"
      ? "w-11 h-6 after:h-5 after:w-5"
      : "w-9 h-5 after:h-4 after:w-4";

  return (
    <label
      className={cn(
        TW.layout.relative,
        TW.layout.inlineFlex,
        TW.layout.itemsCenter,
        disabled ? TW.state.disabled : TW.state.cursorPointer
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
        aria-label={label || "Toggle"}
      />
      <div
        className={cn(
          trackSizeClass,
          "bg-neutral-700 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:transition-all peer-checked:bg-emerald-500"
        )}
      />
    </label>
  );
}
