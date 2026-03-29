import Link from "next/link";
import Image from "next/image";
import Logo from "@/components/Logo";
import { DiscordIcon } from "@/components/icons";

export default function Footer() {
  return (
    <footer className="bg-neutral-100 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-6 py-12 lg:py-16">
        {/* Main footer content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand column */}
          <div className="lg:col-span-4">
            <Link
              href="/"
              className="inline-flex items-center min-h-[44px] min-w-[44px] mb-4 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Logo size="footer" />
              <span className="font-semibold text-foreground ml-3">Cursor Boston</span>
            </Link>
            <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed mb-6 max-w-xs">
              Bringing Cursor users together in Beantown. Meetups, workshops, and community for AI-powered development.
            </p>
            <a
              href="https://discord.gg/Wsncg8YYqc"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Join Discord server (opens in new tab)"
              className="inline-flex items-center bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <DiscordIcon size={18} className="mr-2" />
              Join Discord
            </a>
          </div>

          {/* Links columns */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              {/* Site links */}
              <div>
                <h3 className="text-foreground font-semibold text-sm mb-4">Site</h3>
                <ul className="space-y-3">
                  <li>
                    <Link href="/events" className="text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-foreground focus-visible:underline">
                      Events
                    </Link>
                  </li>
                  <li>
                    <Link href="/talks" className="text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-foreground focus-visible:underline">
                      Talks
                    </Link>
                  </li>
                  <li>
                    <Link href="/blog" className="text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-foreground focus-visible:underline">
                      Blog
                    </Link>
                  </li>
                  <li>
                    <Link href="/about" className="text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-foreground focus-visible:underline">
                      About
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Community links */}
              <div>
                <h3 className="text-foreground font-semibold text-sm mb-4">Community</h3>
                <ul className="space-y-3">
                  <li>
                    <a
                      href="https://discord.gg/Wsncg8YYqc"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Discord (opens in new tab)"
                      className="text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white text-sm transition-colors inline-flex items-center focus-visible:outline-none focus-visible:text-foreground focus-visible:underline"
                    >
                      Discord
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-1" aria-hidden="true">
                        <path d="M7 17l9.2-9.2M17 17V7H7" />
                      </svg>
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://lu.ma/cursor-boston"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Luma (opens in new tab)"
                      className="text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white text-sm transition-colors inline-flex items-center focus-visible:outline-none focus-visible:text-foreground focus-visible:underline"
                    >
                      Luma
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-1" aria-hidden="true">
                        <path d="M7 17l9.2-9.2M17 17V7H7" />
                      </svg>
                    </a>
                  </li>
                  <li>
                    <Link href="/open-source" className="text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-foreground focus-visible:underline">
                      Open Source
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Cursor links */}
              <div>
                <h3 className="text-foreground font-semibold text-sm mb-4">Cursor</h3>
                <ul className="space-y-3">
                  <li>
                    <a
                      href="https://cursor.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="cursor.com (opens in new tab)"
                      className="text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white text-sm transition-colors inline-flex items-center focus-visible:outline-none focus-visible:text-foreground focus-visible:underline"
                    >
                      cursor.com
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-1" aria-hidden="true">
                        <path d="M7 17l9.2-9.2M17 17V7H7" />
                      </svg>
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://cursor.com/community"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Cursor Global Community (opens in new tab)"
                      className="text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white text-sm transition-colors inline-flex items-center focus-visible:outline-none focus-visible:text-foreground focus-visible:underline"
                    >
                      Global Community
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-1" aria-hidden="true">
                        <path d="M7 17l9.2-9.2M17 17V7H7" />
                      </svg>
                    </a>
                  </li>
                  <li>
                    <Link href="/about-cursor" className="text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-foreground focus-visible:underline">
                      About Cursor
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Legal links */}
              <div>
                <h3 className="text-foreground font-semibold text-sm mb-4">Legal</h3>
                <ul className="space-y-3">
                  <li>
                    <Link href="/privacy" className="text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-foreground focus-visible:underline">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" className="text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-foreground focus-visible:underline">
                      Terms of Service
                    </Link>
                  </li>
                  <li>
                    <Link href="/code-of-conduct" className="text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-foreground focus-visible:underline">
                      Code of Conduct
                    </Link>
                  </li>
                  <li>
                    <Link href="/accessibility" className="text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-foreground focus-visible:underline">
                      Accessibility
                    </Link>
                  </li>
                  <li>
                    <Link href="/disclaimer" className="text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-foreground focus-visible:underline">
                      Disclaimer
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Gauntlet AI Sponsor */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 mt-12 pt-8">
          <a
            href="https://referred.gauntletai.com/7fbSz2"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Learn more about Gauntlet AI (opens in new tab)"
            className="block bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 sm:p-5 hover:border-neutral-400 dark:hover:border-neutral-600 hover:bg-white dark:hover:bg-neutral-800/50 transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white dark:bg-white rounded-lg flex items-center justify-center shrink-0 p-2 border border-neutral-100 dark:border-none">
                  <Image
                    src="/gauntlet-logo.png"
                    alt="Gauntlet"
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-foreground font-semibold text-sm">
                    Level up your AI engineering career with Gauntlet
                  </p>
                  <p className="text-neutral-600 dark:text-neutral-400 text-xs mt-0.5">
                    Elite training program for AI-powered development
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-medium rounded-lg group-hover:bg-neutral-800 dark:group-hover:bg-neutral-200 transition-colors shrink-0">
                Learn More
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="ml-1"
                  aria-hidden="true"
                >
                  <path d="M7 17l9.2-9.2M17 17V7H7" />
                </svg>
              </span>
            </div>
          </a>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-neutral-600 dark:text-neutral-400 text-sm">
            © {new Date().getFullYear()} Cursor Boston
          </p>
          <a
            href="mailto:hello@cursorboston.com"
            className="text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white text-sm transition-colors mt-4 sm:mt-0 focus-visible:outline-none focus-visible:text-foreground focus-visible:underline"
          >
            hello@cursorboston.com
          </a>
        </div>
      </div>
    </footer>
  );
}
