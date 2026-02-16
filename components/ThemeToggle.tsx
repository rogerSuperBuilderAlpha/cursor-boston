"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuItemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  React.useEffect(() => {
    setMounted(true);

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Focus the active theme option (or first item) when the menu opens
  React.useEffect(() => {
    if (isOpen) {
      const activeIndex = themeOptions.findIndex((opt) => opt.value === theme);
      const index = activeIndex >= 0 ? activeIndex : 0;
      setFocusedIndex(index);
      menuItemRefs.current[index]?.focus();
    } else {
      setFocusedIndex(-1);
    }
  }, [isOpen, theme]);

  const closeAndRestoreFocus = React.useCallback(() => {
    setIsOpen(false);
    buttonRef.current?.focus();
  }, []);

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
        setIsOpen(false);
        break;
      }
    }
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsOpen(true);
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
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleTriggerKeyDown}
        className="rounded-md p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus:outline-none focus:ring-2 focus:ring-foreground"
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
          className="absolute right-0 mt-2 w-36 rounded-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-lg ring-1 ring-black ring-opacity-5 z-50"
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
                  className={`flex w-full items-center px-4 py-2 text-sm focus:outline-none ${
                    theme === option.value
                      ? "bg-neutral-100 dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400"
                      : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  } ${focusedIndex === index ? "ring-2 ring-inset ring-foreground" : ""}`}
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
