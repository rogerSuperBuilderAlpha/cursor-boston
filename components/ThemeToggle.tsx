"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!mounted) {
    return <div className="w-9 h-9" />;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
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
          className="absolute right-0 mt-2 w-36 rounded-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
        >
          <div className="py-1" role="none">
            <button
              role="menuitem"
              onClick={() => {
                setTheme("light");
                setIsOpen(false);
              }}
              className={`flex w-full items-center px-4 py-2 text-sm ${
                theme === "light"
                  ? "bg-neutral-100 dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400"
                  : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              <Sun className="mr-3 h-4 w-4" />
              Light
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setTheme("dark");
                setIsOpen(false);
              }}
              className={`flex w-full items-center px-4 py-2 text-sm ${
                theme === "dark"
                  ? "bg-neutral-100 dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400"
                  : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              <Moon className="mr-3 h-4 w-4" />
              Dark
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setTheme("system");
                setIsOpen(false);
              }}
              className={`flex w-full items-center px-4 py-2 text-sm ${
                theme === "system"
                  ? "bg-neutral-100 dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400"
                  : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              <Monitor className="mr-3 h-4 w-4" />
              System
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
