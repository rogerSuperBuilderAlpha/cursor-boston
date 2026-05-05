/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { InputHTMLAttributes, ReactNode } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";

interface ValidatedInputProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string | null;
  helperText?: ReactNode;
  showStatusIcon?: boolean;
}

const baseInputClass =
  "w-full px-4 py-3 bg-neutral-100 dark:bg-neutral-800 border border-neutral-700 rounded-lg text-foreground text-base placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-transparent";

export function ValidatedInput({
  id,
  label,
  error,
  helperText,
  showStatusIcon = false,
  className,
  "aria-describedby": ariaDescribedBy,
  ...props
}: ValidatedInputProps) {
  const helperId = helperText ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [ariaDescribedBy, helperId, errorId].filter(Boolean).join(" ") || undefined;
  const hasSuccessIcon = showStatusIcon && !error && Boolean(props.value);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-300 mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? "true" : undefined}
          className={`${baseInputClass}${showStatusIcon ? " pr-11" : ""}${className ? ` ${className}` : ""}`}
        />
        {showStatusIcon && error && (
          <CircleAlert
            aria-hidden="true"
            className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-red-400"
          />
        )}
        {hasSuccessIcon && (
          <CheckCircle2
            aria-hidden="true"
            className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-400"
          />
        )}
      </div>
      {helperText && (
        <p id={helperId} className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {helperText}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
