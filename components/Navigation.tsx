"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/Avatar";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const rafRef = useRef<number>(0);

  // Close mobile menu on route change (handles browser back/forward too)
  useEffect(() => {
    rafRef.current = requestAnimationFrame(() => setMobileMenuOpen(false));
    return () => cancelAnimationFrame(rafRef.current);
  }, [pathname]);

  // Shared active/inactive class logic — mobile adds py-3 text-base, desktop adds text-sm whitespace-nowrap
  // /login intentionally highlights when on the login page for consistency with other nav links
  const buildNavClass = (href: string, mobile = false) =>
    `${pathname === href ? "text-foreground font-semibold" : "text-neutral-600 dark:text-neutral-300 font-medium"} hover:text-black dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:text-foreground focus-visible:underline ${mobile ? "py-3 text-base" : "text-sm whitespace-nowrap"}`;

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo: 44px min touch target (WCAG 2.1) */}
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
          <span className="text-foreground font-semibold text-lg hidden sm:block">Cursor Boston</span>
        </Link>

        {/* Desktop Nav */}
        <nav aria-label="Main" className="hidden lg:flex items-center space-x-8 ml-12">
          <Link href="/events" className={buildNavClass("/events")}>Events</Link>
          <Link href="/map" className={buildNavClass("/map")}>Map</Link>
          <Link href="/talks" className={buildNavClass("/talks")}>Talks</Link>
          <Link href="/hackathons" className={buildNavClass("/hackathons")}>Hackathons</Link>
          <Link href="/blog" className={buildNavClass("/blog")}>Blog</Link>
          <Link href="/members" className={buildNavClass("/members")}>Members</Link>
          <Link href="/opportunities" className={buildNavClass("/opportunities")}>Opportunities</Link>
          <Link href="/showcase" className={buildNavClass("/showcase")}>Showcase</Link>
          <Link href="/pair" className={buildNavClass("/pair")}>Pair Programming</Link>
          <Link href="/about" className={buildNavClass("/about")}>About</Link>
        </nav>

        {/* Spacer */}
        <div className="hidden lg:block flex-1" />

        {/* Desktop Auth */}
        <div className="hidden lg:flex items-center shrink-0 gap-4">
          <ThemeToggle />
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
          ) : user ? (
            <Link href="/profile" className="flex items-center hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg">
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
        <div className="flex items-center gap-4 lg:hidden">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white p-2 shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div id="mobile-menu" className="lg:hidden border-t border-neutral-200 dark:border-neutral-800 bg-background">
          <div className="max-w-6xl mx-auto px-6 py-4">
            {/* Menu closes via the pathname useEffect — onClick handlers not needed on nav links */}
            <nav aria-label="Mobile" className="flex flex-col space-y-1">
              <Link href="/events" className={buildNavClass("/events", true)}>Events</Link>
              <Link href="/map" className={buildNavClass("/map", true)}>Map</Link>
              <Link href="/talks" className={buildNavClass("/talks", true)}>Talks</Link>
              <Link href="/hackathons" className={buildNavClass("/hackathons", true)}>Hackathons</Link>
              <Link href="/blog" className={buildNavClass("/blog", true)}>Blog</Link>
              <Link href="/members" className={buildNavClass("/members", true)}>Members</Link>
              <Link href="/opportunities" className={buildNavClass("/opportunities", true)}>Opportunities</Link>
              <Link href="/showcase" className={buildNavClass("/showcase", true)}>Showcase</Link>
              <Link href="/pair" className={buildNavClass("/pair", true)}>Pair Programming</Link>
              <Link href="/about" className={buildNavClass("/about", true)}>About</Link>
            </nav>

            <div className="border-t border-neutral-200 dark:border-neutral-800 mt-4 pt-4">
              {loading ? (
                <div className="h-12 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
              ) : user ? (
                <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="flex items-center p-3 bg-neutral-100 dark:bg-neutral-900 rounded-lg">
                  <Avatar
                    src={user.photoURL}
                    name={user.displayName}
                    email={user.email}
                    size="md"
                  />
                  <div className="ml-3">
                    <p className="text-foreground font-medium">{user.displayName || "User"}</p>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm">{user.email}</p>
                  </div>
                </Link>
              ) : (
                <div className="space-y-3">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block w-full text-center py-3 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 rounded-lg font-medium transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                    Sign In
                  </Link>
                  <Link href="/signup" onClick={() => setMobileMenuOpen(false)} className="block w-full text-center py-3 bg-emerald-500 text-white rounded-lg font-semibold transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
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
