/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";

interface TagsFieldProps {
  label: string;
  placeholder: string;
  options: readonly string[];
  value: string[];
  isOpen: boolean;
  onOpen: () => void;
  onChange: (value: string[]) => void;
}

export function TagsField({
  label,
  placeholder,
  options,
  value,
  isOpen,
  onOpen,
  onChange,
}: TagsFieldProps) {
  const [draft, setDraft] = useState("");

  const addValue = (rawValue: string) => {
    const nextValue = rawValue.trim();
    if (!nextValue) return;
    if (value.some((item) => item.toLowerCase() === nextValue.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, nextValue]);
    setDraft("");
  };

  const removeValue = (item: string) => {
    onChange(value.filter((current) => current !== item));
  };

  const toggleOption = (option: string) => {
    if (value.includes(option)) {
      removeValue(option);
    } else {
      onChange([...value, option]);
    }
  };

  return (
    <div className="relative">
      <label className="block">
        <span className="text-sm font-medium text-white">{label}</span>
        <div
          className="mt-2 min-h-[3.5rem] rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 focus-within:border-emerald-400"
          onClick={onOpen}
        >
          <div className="flex flex-wrap gap-2">
            {value.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100"
              >
                {item}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeValue(item);
                  }}
                  className="text-emerald-200 hover:text-white"
                  aria-label={`Remove ${item}`}
                >
                  x
                </button>
              </span>
            ))}
            <input
              value={draft}
              onFocus={onOpen}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addValue(draft);
                }
                if (event.key === "Backspace" && !draft && value.length > 0) {
                  removeValue(value[value.length - 1]);
                }
              }}
              placeholder={value.length === 0 ? placeholder : "Add another..."}
              className="min-w-[10rem] flex-1 bg-transparent py-1 text-sm text-white placeholder:text-neutral-600 focus:outline-none"
            />
          </div>
        </div>
      </label>

      {isOpen && (
        <div
          className="absolute z-30 mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-950 p-3 shadow-2xl"
          onMouseDown={(event) => event.preventDefault()}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onOpen();
                  toggleOption(option);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-neutral-300 hover:bg-neutral-900"
              >
                <input
                  type="checkbox"
                  checked={value.includes(option)}
                  readOnly
                  tabIndex={-1}
                  className="h-4 w-4 accent-emerald-400"
                />
                {option}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addValue(draft);
                }
              }}
              placeholder="Type anything else..."
              className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-emerald-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => addValue(draft)}
              className="rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-300"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
