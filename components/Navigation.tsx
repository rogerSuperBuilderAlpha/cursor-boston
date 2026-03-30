"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/Avatar";
import { ThemeToggle } from "@/components/ThemeToggle";

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Community",
    items: [
      { label: "Events", href: "/events" },
      { label: "Talks", href: "/talks" },
      { label: "Members", href: "/members" },
      { label: "Pair Programming", href: "/pair" },
    ],
  },
  {
    label: "Participate",
    items: [
      { label: "Hackathons", href: "/hackathons" },
      { label: "Showcase", href: "/showcase" },
      { label: "Cookbook", href: "/cookbook" },
      { label: "Opportunities", href: "/opportunities" },
    ],
  },
  {
    label: "Resources",
    items: [
      { label: "Map", href: "/map" },
      { label: "Blog", href: "/blog" },
      { label: "Analytics", href: "/analytics" },
    ],
  },
  {
    label: "About",
    items: [{ label: "About", href: "/about" }],
  },
];

function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.items.some((item) => pathname === item.href);
}

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileOpenGroups, setMobileOpenGroups] = useState<string[]>([]);
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const rafRef = useRef<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on route change
  useEffect(() => {
    rafRef.current = requestAnimationFrame(() => {
      setMobileMenuOpen(false);
      setOpenDropdown(null);
      setMobileOpenGroups([]);
    });
    return () => cancelAnimationFrame(rafRef.current);
  }, [pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const buildNavClass = (href: string, mobile = false, inDropdown = false) =>
    `${pathname === href ? "text-foreground font-semibold" : "text-neutral-600 dark:text-neutral-300 font-medium"} hover:text-black dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:text-foreground focus-visible:underline ${mobile ? (inDropdown ? "py-2 pl-4 text-sm" : "py-3 text-base") : inDropdown ? "block py-2 px-4 text-sm" : "text-sm whitespace-nowrap"}`;

  const toggleMobileGroup = (label: string) => {
    setMobileOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors duration-300">
      <div className="w-full px-4 md:px-6 h-16 flex items-center">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0 min-h-[44px] min-w-[44px] py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
        >
          <div className="w-8 h-8 bg-neutral-100 dark:bg-black border border-neutral-200 dark:border-neutral-700 rounded-md flex items-center justify-center shrink-0">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              style={{ transform: "rotate(-45deg)" }}
              aria-hidden
            >
              <path
                d="M5 3l14 9-6 2-3 6-5-17z"
                fill="#10b981"
                stroke="#10b981"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-foreground font-semibold text-lg hidden sm:block">
            Cursor Boston
          </span>
        </Link>

        {/* Desktop Nav with Dropdowns */}
        <nav
          aria-label="Main"
          className="hidden xl:flex items-center gap-1 ml-8 flex-1 min-w-0"
          ref={dropdownRef}
        >
          {navGroups.map((group) => {
            const isActive = isGroupActive(group, pathname);
            const isOpen = openDropdown === group.label;
            const hasMultipleItems = group.items.length > 1;

            return (
              <div key={group.label} className="relative">
                {hasMultipleItems ? (
                  <>
                    <button
                      onClick={() =>
                        setOpenDropdown(isOpen ? null : group.label)
                      }
                      onMouseEnter={() => setOpenDropdown(group.label)}
                      className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                        isActive
                          ? "text-foreground font-semibold"
                          : "text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white"
                      }`}
                      aria-expanded={isOpen}
                      aria-haspopup="menu"
                    >
                      {group.label}
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {isOpen && (
                      <div
                        className="absolute top-full left-0 mt-1 w-48 bg-background border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg py-2 z-50"
                        onMouseLeave={() => setOpenDropdown(null)}
                        role="menu"
                      >
                        {group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={buildNavClass(item.href, false, true)}
                            role="menuitem"
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={group.items[0].href}
                    className={buildNavClass(group.items[0].href)}
                  >
                    {group.items[0].label}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>

        {/* Desktop Auth */}
        <div className="hidden xl:flex items-center shrink-0 gap-4 pl-6">
          <ThemeToggle />
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
          ) : user ? (
            <Link
              href="/profile"
              className="flex items-center hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
            >
              <Avatar
                src={user.photoURL}
                name={user.displayName}
                email={user.email}
                size="sm"
              />
              <span className="text-sm text-neutral-600 dark:text-neutral-300 ml-2 whitespace-nowrap">
                {user.displayName || user.email?.split("@")[0]}
              </span>
            </Link>
          ) : (
            <div className="flex items-center">
              <Link href="/login" className={`${buildNavClass("/login")} mr-6`}>
                Sign In
              </Link>
              <Link
                href="/signup"
                className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="ml-auto flex items-center gap-4 xl:hidden">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white p-2 shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile / tablet menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="xl:hidden border-t border-neutral-200 dark:border-neutral-800 bg-background"
        >
          <div className="w-full px-4 md:px-6 py-6 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {/* Mobile nested navigation */}
            <nav aria-label="Mobile" className="flex flex-col space-y-1">
              {navGroups.map((group) => {
                const isOpen = mobileOpenGroups.includes(group.label);
                const hasMultipleItems = group.items.length > 1;

                return (
                  <div key={group.label}>
                    {hasMultipleItems ? (
                      <>
                        <button
                          onClick={() => toggleMobileGroup(group.label)}
                          className={`flex items-center justify-between w-full py-3 text-base font-medium transition-colors ${
                            isGroupActive(group, pathname)
                              ? "text-foreground font-semibold"
                              : "text-neutral-600 dark:text-neutral-300"
                          }`}
                          aria-expanded={isOpen}
                        >
                          {group.label}
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                        {isOpen && (
                          <div className="flex flex-col border-l-2 border-neutral-200 dark:border-neutral-800 ml-2">
                            {group.items.map((item) => (
                              <Link
                                key={item.href}
                                href={item.href}
                                className={buildNavClass(item.href, true, true)}
                              >
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <Link
                        href={group.items[0].href}
                        className={buildNavClass(group.items[0].href, true)}
                      >
                        {group.items[0].label}
                      </Link>
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="border-t border-neutral-200 dark:border-neutral-800 mt-6 pt-6">
              {loading ? (
                <div className="h-14 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
              ) : user ? (
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-4 p-4 rounded-xl bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                >
                  <Avatar
                    src={user.photoURL}
                    name={user.displayName}
                    email={user.email}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground font-semibold truncate">
                      {user.displayName || "User"}
                    </p>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm truncate">
                      {user.email}
                    </p>
                  </div>
                </Link>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-center py-3 px-4 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 rounded-xl font-medium transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-center py-3 px-4 bg-emerald-500 text-white rounded-xl font-semibold transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
