"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/Avatar";

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-black border-b border-neutral-800">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg">
          <div className="w-8 h-8 bg-black border border-neutral-700 rounded-md flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              style={{ transform: "rotate(-45deg)" }}
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
          <span className="text-white font-semibold text-lg hidden sm:block">Cursor Boston</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center space-x-8 ml-12">
          <Link href="/events" className="text-neutral-300 hover:text-white text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
            Events
          </Link>
          <Link href="/talks" className="text-neutral-300 hover:text-white text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
            Talks
          </Link>
          <Link href="/hackathons" className="text-neutral-300 hover:text-white text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
            Hackathons
          </Link>
          <Link href="/blog" className="text-neutral-300 hover:text-white text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
            Blog
          </Link>
          <Link href="/members" className="text-neutral-300 hover:text-white text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
            Members
          </Link>
          <Link href="/opportunities" className="text-neutral-300 hover:text-white text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
            Opportunities
          </Link>
          <Link href="/about" className="text-neutral-300 hover:text-white text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
            About
          </Link>
        </nav>

        {/* Spacer */}
        <div className="hidden lg:block flex-1" />

        {/* Desktop Auth */}
        <div className="hidden lg:flex items-center flex-shrink-0">
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-neutral-800 animate-pulse" />
          ) : user ? (
            <Link href="/profile" className="flex items-center hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg">
              <Avatar
                src={user.photoURL}
                name={user.displayName}
                email={user.email}
                size="sm"
              />
              <span className="text-sm text-neutral-300 ml-2 whitespace-nowrap">
                {user.displayName || user.email?.split("@")[0]}
              </span>
            </Link>
          ) : (
            <div className="flex items-center">
              <Link href="/login" className="text-neutral-300 hover:text-white text-sm font-medium mr-6 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
                Sign In
              </Link>
              <Link
                href="/signup"
                className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden text-neutral-400 hover:text-white p-2 flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg"
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

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div id="mobile-menu" className="lg:hidden border-t border-neutral-800 bg-black">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <nav className="flex flex-col space-y-1">
              <Link href="/events" onClick={() => setMobileMenuOpen(false)} className="text-neutral-300 hover:text-white py-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
                Events
              </Link>
              <Link href="/talks" onClick={() => setMobileMenuOpen(false)} className="text-neutral-300 hover:text-white py-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
                Talks
              </Link>
              <Link href="/hackathons" onClick={() => setMobileMenuOpen(false)} className="text-neutral-300 hover:text-white py-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
                Hackathons
              </Link>
              <Link href="/blog" onClick={() => setMobileMenuOpen(false)} className="text-neutral-300 hover:text-white py-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
                Blog
              </Link>
              <Link href="/members" onClick={() => setMobileMenuOpen(false)} className="text-neutral-300 hover:text-white py-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
                Members
              </Link>
              <Link href="/opportunities" onClick={() => setMobileMenuOpen(false)} className="text-neutral-300 hover:text-white py-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
                Opportunities
              </Link>
              <Link href="/about" onClick={() => setMobileMenuOpen(false)} className="text-neutral-300 hover:text-white py-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
                About
              </Link>
            </nav>

            <div className="border-t border-neutral-800 mt-4 pt-4">
              {loading ? (
                <div className="h-12 bg-neutral-800 rounded-lg animate-pulse" />
              ) : user ? (
                <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="flex items-center p-3 bg-neutral-900 rounded-lg">
                  <Avatar
                    src={user.photoURL}
                    name={user.displayName}
                    email={user.email}
                    size="md"
                  />
                  <div className="ml-3">
                    <p className="text-white font-medium">{user.displayName || "User"}</p>
                    <p className="text-neutral-400 text-sm">{user.email}</p>
                  </div>
                </Link>
              ) : (
                <div className="space-y-3">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block w-full text-center py-3 text-neutral-300 border border-neutral-700 rounded-lg font-medium transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black">
                    Sign In
                  </Link>
                  <Link href="/signup" onClick={() => setMobileMenuOpen(false)} className="block w-full text-center py-3 bg-emerald-500 text-white rounded-lg font-semibold transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black">
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
