import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-neutral-950 border-t border-neutral-800">
      <div className="max-w-6xl mx-auto px-6 py-12 lg:py-16">
        {/* Main footer content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand column */}
          <div className="lg:col-span-4">
            <Link href="/" className="inline-flex items-center mb-4 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950">
              <div className="w-8 h-8 relative">
                <Image
                  src="/cursor-boston-logo.png"
                  alt="Cursor Boston"
                  fill
                  unoptimized
                  className="object-contain"
                />
              </div>
              <span className="font-semibold text-white ml-3">Cursor Boston</span>
            </Link>
            <p className="text-neutral-400 text-sm leading-relaxed mb-6 max-w-xs">
              Bringing Cursor users together in Beantown. Meetups, workshops, and community for AI-powered development.
            </p>
            <a
              href="https://discord.gg/Wsncg8YYqc"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Join Discord server (opens in new tab)"
              className="inline-flex items-center bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2] focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="mr-2">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Join Discord
            </a>
          </div>

          {/* Links columns */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              {/* Site links */}
              <div>
                <h3 className="text-white font-semibold text-sm mb-4">Site</h3>
                <ul className="space-y-3">
                  <li>
                    <Link href="/events" className="text-neutral-400 hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
                      Events
                    </Link>
                  </li>
                  <li>
                    <Link href="/talks" className="text-neutral-400 hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
                      Talks
                    </Link>
                  </li>
                  <li>
                    <Link href="/blog" className="text-neutral-400 hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
                      Blog
                    </Link>
                  </li>
                  <li>
                    <Link href="/about" className="text-neutral-400 hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
                      About
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Community links */}
              <div>
                <h3 className="text-white font-semibold text-sm mb-4">Community</h3>
                <ul className="space-y-3">
                  <li>
                    <a
                      href="https://discord.gg/Wsncg8YYqc"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Discord (opens in new tab)"
                      className="text-neutral-400 hover:text-white text-sm transition-colors inline-flex items-center focus-visible:outline-none focus-visible:text-white focus-visible:underline"
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
                      className="text-neutral-400 hover:text-white text-sm transition-colors inline-flex items-center focus-visible:outline-none focus-visible:text-white focus-visible:underline"
                    >
                      Luma
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-1" aria-hidden="true">
                        <path d="M7 17l9.2-9.2M17 17V7H7" />
                      </svg>
                    </a>
                  </li>
                  <li>
                    <Link href="/open-source" className="text-neutral-400 hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
                      Open Source
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Cursor links */}
              <div>
                <h3 className="text-white font-semibold text-sm mb-4">Cursor</h3>
                <ul className="space-y-3">
                  <li>
                    <a
                      href="https://cursor.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="cursor.com (opens in new tab)"
                      className="text-neutral-400 hover:text-white text-sm transition-colors inline-flex items-center focus-visible:outline-none focus-visible:text-white focus-visible:underline"
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
                      className="text-neutral-400 hover:text-white text-sm transition-colors inline-flex items-center focus-visible:outline-none focus-visible:text-white focus-visible:underline"
                    >
                      Global Community
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-1" aria-hidden="true">
                        <path d="M7 17l9.2-9.2M17 17V7H7" />
                      </svg>
                    </a>
                  </li>
                  <li>
                    <Link href="/about-cursor" className="text-neutral-400 hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
                      About Cursor
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Legal links */}
              <div>
                <h3 className="text-white font-semibold text-sm mb-4">Legal</h3>
                <ul className="space-y-3">
                  <li>
                    <Link href="/privacy" className="text-neutral-400 hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" className="text-neutral-400 hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
                      Terms of Service
                    </Link>
                  </li>
                  <li>
                    <Link href="/code-of-conduct" className="text-neutral-400 hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
                      Code of Conduct
                    </Link>
                  </li>
                  <li>
                    <Link href="/accessibility" className="text-neutral-400 hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
                      Accessibility
                    </Link>
                  </li>
                  <li>
                    <Link href="/disclaimer" className="text-neutral-400 hover:text-white text-sm transition-colors focus-visible:outline-none focus-visible:text-white focus-visible:underline">
                      Disclaimer
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Gauntlet AI Sponsor */}
        <div className="border-t border-neutral-800 mt-12 pt-8">
          <a
            href="https://referred.gauntletai.com/7fbSz2"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Learn more about Gauntlet AI (opens in new tab)"
            className="block bg-neutral-900 border border-neutral-700 rounded-xl p-4 sm:p-5 hover:border-neutral-600 hover:bg-neutral-800/50 transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shrink-0 p-2">
                  <Image
                    src="/gauntlet-logo.png"
                    alt="Gauntlet"
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-white font-semibold text-sm">
                    Level up your AI engineering career with Gauntlet
                  </p>
                  <p className="text-neutral-400 text-xs mt-0.5">
                    Elite training program for AI-powered development
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg group-hover:bg-neutral-200 transition-colors shrink-0">
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
        <div className="border-t border-neutral-800 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-neutral-500 text-sm">
            © {new Date().getFullYear()} Cursor Boston
          </p>
          <a
            href="mailto:hello@cursorboston.com"
            className="text-neutral-400 hover:text-white text-sm transition-colors mt-4 sm:mt-0 focus-visible:outline-none focus-visible:text-white focus-visible:underline"
          >
            hello@cursorboston.com
          </a>
        </div>
      </div>
    </footer>
  );
}
