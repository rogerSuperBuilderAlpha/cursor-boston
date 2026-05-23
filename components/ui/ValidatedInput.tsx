/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { InputHTMLAttributes, ReactNode } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { CLASS_GROUPS } from "@/lib/classname-constants";
import { cn } from "@/lib/utils";

interface ValidatedInputProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string | null;
  helperText?: ReactNode;
  showStatusIcon?: boolean;
}

const baseInputClass = CLASS_GROUPS.form.inputLightDark;

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
      <label htmlFor={id} className={CLASS_GROUPS.form.labelDark}>
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? "true" : undefined}
          className={cn(baseInputClass, showStatusIcon && "pr-11", className)}
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
        <p id={helperId} className={cn("mt-2", CLASS_GROUPS.text.muted)}>
          {helperText}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className={CLASS_GROUPS.form.errorText}>
          {error}
        </p>
      )}
    </div>
  );
}
