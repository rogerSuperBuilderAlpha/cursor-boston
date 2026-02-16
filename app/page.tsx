import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Logo from "@/components/Logo";

export const metadata: Metadata = {
  title: "Cursor Boston - AI Coding Community",
  description:
    "Boston's community for AI-assisted development with Cursor IDE. Join meetups, workshops, and hackathons for developers, founders, and students.",
  alternates: {
    canonical: "https://cursorboston.com",
  },
};

const audienceCards = [
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    ),
    title: "Students",
    description:
      "From MIT, Harvard, Hult, BU, Northeastern, and beyond. Learn AI-powered development skills that will set you apart.",
  },
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
      </svg>
    ),
    title: "Startup Founders",
    description:
      "Prototype MVPs in hours, not weeks. Build landing pages, dashboards, and validate ideas without a technical co-founder.",
  },
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    title: "Developers",
    description:
      "Ship production-ready features faster. Debug, test, and build full-stack applications with AI assistance.",
  },
  {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        <path d="M19 3v4" />
        <path d="M21 5h-4" />
      </svg>
    ),
    title: "Designers & PMs",
    description:
      "Turn designs into code. Build prototypes, automate workflows, and create professional deliverables faster.",
  },
  {
    icon: (
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
        <circle cx="8" cy="16" r="1" fill="currentColor" />
        <circle cx="16" cy="16" r="1" fill="currentColor" />
      </svg>
    ),
    title: "AI Agents",
    description:
      "Yes, agents too! Register your AI agent, claim ownership, and join our community alongside human members.",
    highlight: true,
  },
];

const DISCORD_LINK = "https://discord.gg/Wsncg8YYqc";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="py-16 md:py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Logo size="heroHome" className="mx-auto mb-6" priority />
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 tracking-tight">
            Boston&apos;s Cursor Community
          </h1>
          <p className="text-lg md:text-xl text-neutral-600 dark:text-neutral-300 mb-8 max-w-2xl mx-auto leading-relaxed">
            Bringing Cursor users together in Beantown. Meetups, workshops, and
            community for AI-powered development.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://lu.ma/cursor-boston"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Subscribe to events on Luma (opens in new tab)"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-emerald-500 text-white rounded-lg text-base font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Subscribe to Events
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7 17l9.2-9.2M17 17V7H7" />
              </svg>
            </a>
            <Link
              href="/events"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 border border-neutral-300 dark:border-neutral-700 text-foreground rounded-lg text-base font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              View Events
            </Link>
          </div>
        </div>
      </section>

      {/* Upcoming Event Highlight */}
      <section className="py-16 md:py-20 px-6 bg-neutral-100 dark:bg-neutral-950 transition-colors duration-300">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Upcoming Event
            </h2>
            <Link
              href="/events"
              className="text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors text-sm font-medium focus-visible:outline-none focus-visible:text-foreground focus-visible:underline"
            >
              See all events &rarr;
            </Link>
          </div>

          <div className="grid md:grid-cols-2 gap-10 items-center">
            {/* Event Poster */}
            <div className="relative aspect-[9/16] max-h-[500px] rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-none">
              <Image
                src="/Gemini_Generated_Image_lc032wlc032wlc03.png"
                alt="Cafe Cursor Boston"
                fill
                className="object-contain"
              />
              {/* QR Code Overlay */}
              <div className="absolute bottom-[2%] right-[3%] w-[15%] aspect-square bg-white p-1 rounded border border-neutral-200 dark:border-none shadow-sm">
                <Image
                  src="/luma-qr.png"
                  alt="Scan to register"
                  fill
                  className="object-contain"
                />
              </div>
            </div>

            {/* Event Details */}
            <div className="flex flex-col gap-6">
              <div>
                <span className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium rounded-full mb-4">
                  Meetup
                </span>
                <h3 className="text-xl md:text-2xl font-bold text-foreground mb-3">
                  Cafe Cursor Boston
                </h3>
                <p className="text-neutral-600 dark:text-neutral-300 text-base leading-relaxed">
                  Join us for the first Cursor community event in Boston.
                  Featuring co-working, Cursor workshops for entrepreneurs,
                  engineers, and non-technical folks. Meet the community, learn
                  something new, and grab some coffee.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-neutral-600 dark:text-neutral-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-emerald-500 dark:text-emerald-400 shrink-0"
                    aria-hidden="true"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>Check Luma for date & time</span>
                </div>
                <div className="flex items-center gap-3 text-neutral-600 dark:text-neutral-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-emerald-500 dark:text-emerald-400 shrink-0"
                    aria-hidden="true"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>Cambridge, Massachusetts</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-xs rounded-full border border-neutral-200 dark:border-neutral-700">
                    Cursor Credits
                  </span>
                  <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-xs rounded-full border border-neutral-200 dark:border-neutral-700">
                    Stickers
                  </span>
                  <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-xs rounded-full border border-neutral-200 dark:border-neutral-700">
                    Coffee
                  </span>
                </div>
              </div>

              <a
                href="https://lu.ma/lpki2hd6"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Register for event on Luma (opens in new tab)"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-emerald-500 text-white rounded-lg text-base font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background w-full sm:w-auto luma-checkout--button"
                data-luma-action="checkout"
                data-luma-event-id="lpki2hd6"
              >
                Request to Join
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7 17l9.2-9.2M17 17V7H7" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Who's This For Section */}
      <section className="py-16 md:py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Who&apos;s This For?
            </h2>
            <p className="text-neutral-600 dark:text-neutral-300 text-base md:text-lg max-w-2xl mx-auto">
              Whether you&apos;re deep into your daily Cursor flow or just
              curious about AI-powered development, our events are for everyone.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {audienceCards.map((card, index) => (
              <div
                key={index}
                className={`rounded-xl p-5 border transition-all ${
                  card.highlight
                    ? "bg-purple-500/10 border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/15"
                    : "bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/30 hover:bg-white dark:hover:bg-neutral-900"
                }`}
              >
                <div className={card.highlight ? "text-purple-500 dark:text-purple-400 mb-4" : "text-emerald-600 dark:text-emerald-400 mb-4"}>{card.icon}</div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {card.title}
                  {card.highlight && (
                    <span className="ml-2 text-xs px-2 py-0.5 bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-full">
                      New
                    </span>
                  )}
                </h3>
                <p className="text-neutral-600 dark:text-neutral-300 text-sm leading-relaxed">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Community Section */}
      <section className="py-16 md:py-20 px-6 bg-neutral-100 dark:bg-neutral-950 transition-colors duration-300">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Join Our Community
          </h2>
          <p className="text-neutral-600 dark:text-neutral-300 text-base md:text-lg max-w-2xl mx-auto mb-3">
            Connect with other Cursor users in Boston. Share tips, ask questions,
            and stay updated on upcoming events.
          </p>
          <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-8">
            Growing community of developers, founders & students
          </p>
          <a
            href={DISCORD_LINK}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join Discord server (opens in new tab)"
            className="inline-flex items-center justify-center gap-3 px-6 py-3 md:px-8 md:py-4 bg-[#5865F2] text-white rounded-lg text-base font-semibold hover:bg-[#4752C4] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Join Discord Server
          </a>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Ready to Level Up?
          </h2>
          <p className="text-neutral-600 dark:text-neutral-300 text-base md:text-lg mb-8">
            Subscribe to our Luma calendar to get notified about upcoming
            meetups, workshops, and hackathons in Boston.
          </p>

          <a
            href="https://lu.ma/cursor-boston"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Subscribe on Luma (opens in new tab)"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-emerald-500 text-white rounded-lg text-base font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Subscribe on Luma
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17l9.2-9.2M17 17V7H7" />
            </svg>
          </a>
        </div>
      </section>
    </div>
  );
}
