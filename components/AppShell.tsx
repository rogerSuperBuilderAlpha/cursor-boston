"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BarChart2,
  BookOpen,
  Briefcase,
  Calendar,
  ChefHat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  LayoutGrid,
  LogIn,
  Map,
  Menu,
  MessageSquare,
  Trophy,
  UserPlus,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/Avatar";
import Footer from "@/components/Footer";
import { ThemeToggle } from "@/components/ThemeToggle";

const STORAGE_KEY = "cursor-boston-sidebar-collapsed";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Grouped nav (Community / Participate / Resources / About); flat when sidebar is collapsed. */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Community",
    items: [
      { href: "/events", label: "Events", icon: Calendar },
      { href: "/talks", label: "Talks", icon: MessageSquare },
      { href: "/members", label: "Members", icon: Users },
      { href: "/pair", label: "Pair Programming", icon: UsersRound },
    ],
  },
  {
    label: "Participate",
    items: [
      { href: "/hackathons", label: "Hackathons", icon: Trophy },
      { href: "/showcase", label: "Showcase", icon: LayoutGrid },
      { href: "/cookbook", label: "Cookbook", icon: ChefHat },
      { href: "/opportunities", label: "Opportunities", icon: Briefcase },
    ],
  },
  {
    label: "Resources",
    items: [
      { href: "/map", label: "Map", icon: Map },
      { href: "/blog", label: "Blog", icon: BookOpen },
      { href: "/analytics", label: "Analytics", icon: BarChart2 },
    ],
  },
  {
    label: "About",
    items: [{ href: "/about", label: "About", icon: Info }],
  },
];

function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.items.some((item) => pathname === item.href);
}

function navLinkClass(pathname: string, href: string, collapsed: boolean) {
  const active = pathname === href;
  return [
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    collapsed ? "justify-center px-2" : "",
    active
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : "text-neutral-600 hover:bg-neutral-100 hover:text-foreground dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white",
  ]
    .filter(Boolean)
    .join(" ");
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openNavGroups, setOpenNavGroups] = useState<string[]>(() =>
    NAV_GROUPS.filter((g) => g.items.length > 1).map((g) => g.label),
  );
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") startTransition(() => setCollapsed(true));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      startTransition(() => setMobileOpen(false));
    }
  }, [pathname]);

  const toggleNavGroup = useCallback((label: string) => {
    setOpenNavGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const expandedWidth = !collapsed;

  const openNavSectionIds = useMemo(() => {
    const ids = new Set(openNavGroups);
    for (const g of NAV_GROUPS) {
      if (g.items.length > 1 && isGroupActive(g, pathname)) ids.add(g.label);
    }
    return ids;
  }, [openNavGroups, pathname]);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Mobile drawer backdrop */}
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-neutral-200 bg-background/95 backdrop-blur-md transition-[transform,width] duration-200 ease-out dark:border-neutral-800 md:translate-x-0",
          expandedWidth ? "w-56" : "w-[4.25rem]",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
        aria-label="Site navigation"
      >
        <div
          className={[expandedWidth ? "px-3" : "px-2", "flex h-16 shrink-0 items-center gap-2 border-b border-neutral-200 dark:border-neutral-800"].join(
            " "
          )}
        >
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className={`flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background ${expandedWidth ? "px-1" : "justify-center px-0"}`}
            title="Cursor Boston home"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-black">
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
            {expandedWidth ? (
              <span className="truncate font-semibold text-foreground">Cursor Boston</span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-foreground md:hidden dark:hover:bg-neutral-800"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
          <ul className="flex flex-col gap-0.5">
            {expandedWidth
              ? NAV_GROUPS.map((group) => {
                  const hasMultiple = group.items.length > 1;
                  if (!hasMultiple) {
                    const item = group.items[0];
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={navLinkClass(pathname, item.href, false)}
                        >
                          <Icon className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-90" strokeWidth={2} />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      </li>
                    );
                  }
                  const sectionOpen = openNavSectionIds.has(group.label);
                  return (
                    <li key={group.label} className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => toggleNavGroup(group.label)}
                        className={[
                          "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          isGroupActive(group, pathname)
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-neutral-500 hover:text-foreground dark:text-neutral-400 dark:hover:text-white",
                        ].join(" ")}
                        aria-expanded={sectionOpen}
                      >
                        {group.label}
                        <ChevronDown
                          className={[
                            "h-4 w-4 shrink-0 opacity-80 transition-transform",
                            sectionOpen ? "rotate-180" : "",
                          ].join(" ")}
                          strokeWidth={2}
                          aria-hidden
                        />
                      </button>
                      {sectionOpen ? (
                        <ul className="mb-1 flex flex-col gap-0.5 border-l border-neutral-200 pl-2 dark:border-neutral-800">
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            return (
                              <li key={item.href}>
                                <Link
                                  href={item.href}
                                  onClick={() => setMobileOpen(false)}
                                  className={navLinkClass(pathname, item.href, false)}
                                >
                                  <Icon className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-90" strokeWidth={2} />
                                  <span className="truncate">{item.label}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                })
              : NAV_GROUPS.flatMap((group) =>
                  group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          title={item.label}
                          onClick={() => setMobileOpen(false)}
                          className={navLinkClass(pathname, item.href, true)}
                        >
                          <Icon className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-90" strokeWidth={2} />
                        </Link>
                      </li>
                    );
                  }),
                )}
          </ul>
        </nav>

        <div
          className={[
            "shrink-0 space-y-3 border-t border-neutral-200 py-3 dark:border-neutral-800",
            expandedWidth ? "px-3" : "px-2",
          ].join(" ")}
        >
          <div
            className={[
              "flex items-center gap-2",
              expandedWidth ? "justify-between" : "flex-col justify-center gap-2",
            ].join(" ")}
          >
            <ThemeToggle />
            <button
              type="button"
              onClick={toggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden rounded-lg border border-neutral-200 p-2 text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 md:flex"
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" strokeWidth={2} />
              ) : (
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
              )}
            </button>
          </div>

          <div className={expandedWidth ? "" : "flex justify-center"}>
            {loading ? (
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
            ) : user ? (
              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                className={[
                  "flex items-center gap-3 rounded-lg py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800/80",
                  expandedWidth ? "px-2" : "justify-center px-0",
                ].join(" ")}
                title={!expandedWidth ? "Profile" : undefined}
              >
                <Avatar
                  src={user.photoURL}
                  name={user.displayName}
                  email={user.email}
                  size="sm"
                />
                {expandedWidth ? (
                  <span className="min-w-0 truncate text-neutral-700 dark:text-neutral-300">
                    {user.displayName || user.email?.split("@")[0]}
                  </span>
                ) : null}
              </Link>
            ) : (
              <div
                className={[
                  "flex gap-2",
                  expandedWidth ? "flex-col" : "flex-col items-center",
                ].join(" ")}
              >
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Sign in"
                  className={[
                    "inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800",
                    expandedWidth ? "w-full px-3 py-2" : "h-10 w-10 p-0",
                  ].join(" ")}
                >
                  {expandedWidth ? "Sign In" : <LogIn className="h-5 w-5" strokeWidth={2} />}
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Get started"
                  className={[
                    "inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 text-sm font-semibold text-white transition-colors hover:bg-emerald-400",
                    expandedWidth ? "w-full px-3 py-2" : "h-10 w-10 p-0",
                  ].join(" ")}
                >
                  {expandedWidth ? "Get Started" : <UserPlus className="h-5 w-5" strokeWidth={2} />}
                </Link>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div
        className={[
          "flex min-h-screen min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-out",
          expandedWidth ? "md:pl-56" : "md:pl-[4.25rem]",
        ].join(" ")}
      >
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-neutral-200 bg-background/90 px-4 backdrop-blur-md dark:border-neutral-800 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
          >
            <Menu className="h-6 w-6" strokeWidth={2} />
          </button>
          <Link href="/" className="min-w-0 truncate font-semibold text-foreground">
            Cursor Boston
          </Link>
        </header>

        <main id="main-content" className="flex-1 outline-none" tabIndex={-1}>
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
