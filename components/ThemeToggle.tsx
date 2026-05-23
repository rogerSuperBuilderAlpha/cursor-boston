/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { TAILWIND_CLASS_NAMES as TW } from "@/lib/classname-constants";
import { cn } from "@/lib/utils";

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

function subscribeToMount(): () => void {
  return () => {};
}

function getClientSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    subscribeToMount,
    getClientSnapshot,
    getServerSnapshot
  );
  const [isOpen, setIsOpen] = React.useState(false);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuItemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getActiveIndex = React.useCallback(() => {
    const activeIndex = themeOptions.findIndex((opt) => opt.value === theme);
    return activeIndex >= 0 ? activeIndex : 0;
  }, [theme]);

  const focusMenuItem = React.useCallback((index: number) => {
    requestAnimationFrame(() => {
      menuItemRefs.current[index]?.focus();
    });
  }, []);

  const closeMenu = React.useCallback(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
  }, []);

  const openMenu = React.useCallback(() => {
    const index = getActiveIndex();
    setFocusedIndex(index);
    setIsOpen(true);
    focusMenuItem(index);
  }, [focusMenuItem, getActiveIndex]);

  const closeAndRestoreFocus = React.useCallback(() => {
    closeMenu();
    buttonRef.current?.focus();
  }, [closeMenu]);

  const handleDropdownKeyDownCapture = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isOpen && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeAndRestoreFocus();
    }
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        const next = (focusedIndex + 1) % themeOptions.length;
        setFocusedIndex(next);
        menuItemRefs.current[next]?.focus();
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        const prev = (focusedIndex - 1 + themeOptions.length) % themeOptions.length;
        setFocusedIndex(prev);
        menuItemRefs.current[prev]?.focus();
        break;
      }
      case "Home": {
        event.preventDefault();
        setFocusedIndex(0);
        menuItemRefs.current[0]?.focus();
        break;
      }
      case "End": {
        event.preventDefault();
        const last = themeOptions.length - 1;
        setFocusedIndex(last);
        menuItemRefs.current[last]?.focus();
        break;
      }
      case "Escape": {
        event.preventDefault();
        closeAndRestoreFocus();
        break;
      }
      case "Tab": {
        // Close menu on Tab and let the browser move focus naturally.
        closeMenu();
        break;
      }
    }
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMenu();
    }
  };

  const selectTheme = (value: string) => {
    setTheme(value);
    closeAndRestoreFocus();
  };

  if (!mounted) {
    return <div className="w-9 h-9" />;
  }

  return (
    <div className="relative" ref={dropdownRef} onKeyDownCapture={handleDropdownKeyDownCapture}>
      <button
        ref={buttonRef}
        onClick={() => {
          if (isOpen) {
            closeMenu();
          } else {
            openMenu();
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          TW.radius.md,
          TW.spacing.p2,
          TW.state.hoverNeutral,
          TW.motion.colors,
          TW.focus.foreground
        )}
        aria-label="Toggle theme"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls="theme-menu"
      >
        <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute top-2 left-2 h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </button>

      {isOpen && (
        <div
          id="theme-menu"
          role="menu"
          aria-label="Theme selection"
          onKeyDown={handleMenuKeyDown}
          className={cn(
            "absolute left-full bottom-0 ml-2 w-36 shadow-lg ring-1 ring-black ring-opacity-5 z-50",
            TW.radius.md,
            TW.surface.card,
            TW.border.neutral
          )}
        >
          <div className="py-1" role="none">
            {themeOptions.map((option, index) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  ref={(el) => { menuItemRefs.current[index] = el; }}
                  role="menuitem"
                  tabIndex={focusedIndex === index ? 0 : -1}
                  onClick={() => selectTheme(option.value)}
                  className={cn(
                    "flex w-full items-center px-4 py-2 text-sm focus:outline-none",
                    theme === option.value
                      ? "bg-neutral-100 dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400"
                      : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800",
                    focusedIndex === index && "ring-2 ring-inset ring-foreground"
                  )}
                >
                  <Icon className="mr-3 h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
