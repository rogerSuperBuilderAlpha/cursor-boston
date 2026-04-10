/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Logo from "@/components/Logo";
import { DiscordIcon } from "@/components/icons";
import eventsData from "@/content/events.json";
import { getLumaCheckoutEventId, getLumaCheckoutHref } from "@/lib/luma-event";
import type { Event, EventsData } from "@/types/events";

export const metadata: Metadata = {
  title: "Cursor Boston - AI Coding Community",
  description:
    "Boston's community for AI-assisted development with Cursor IDE. Join meetups, workshops, and hackathons for developers, founders, and students.",
  alternates: {
    canonical: "https://cursorboston.com",
  },
};

const audienceCardColors = {
  blue: "bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50 hover:bg-blue-500/15 text-blue-600 dark:text-blue-400",
  amber: "bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/15 text-amber-600 dark:text-amber-400",
  emerald: "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  rose: "bg-rose-500/10 border-rose-500/30 hover:border-rose-500/50 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400",
  purple: "bg-purple-500/10 border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/15 text-purple-600 dark:text-purple-400",
} as const;

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
    accent: "blue" as keyof typeof audienceCardColors,
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
    accent: "amber" as keyof typeof audienceCardColors,
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
    accent: "emerald" as keyof typeof audienceCardColors,
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
    accent: "rose" as keyof typeof audienceCardColors,
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
    accent: "purple" as keyof typeof audienceCardColors,
    highlight: true,
  },
];

const DISCORD_LINK = "https://discord.gg/Wsncg8YYqc";

const eventsJson = eventsData as unknown as EventsData;
const featuredHackathon = eventsJson.upcoming.find(
  (e: Event) => e.type === "hackathon" && e.featured
);

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

      {/* Featured hackathon — Hack-a-Sprint */}
      {featuredHackathon ? (
        <section className="py-16 md:py-20 px-6 bg-neutral-100 dark:bg-neutral-950 transition-colors duration-300">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                Featured: Hack-a-Sprint
              </h2>
              <div className="flex flex-wrap gap-4 text-sm font-medium">
                <Link
                  href="/hackathons"
                  className="text-emerald-600 dark:text-emerald-400 hover:underline focus-visible:outline-none focus-visible:underline"
                >
                  Hackathons &amp; details &rarr;
                </Link>
                <Link
                  href="/events"
                  className="text-neutral-600 dark:text-neutral-300 hover:text-foreground focus-visible:outline-none focus-visible:underline"
                >
                  All events &rarr;
                </Link>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="relative aspect-square max-h-[320px] md:max-h-[380px] rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 mx-auto w-full max-w-md">
                <Image
                  src={featuredHackathon.image}
                  alt={`${featuredHackathon.title} graphic`}
                  fill
                  className="object-contain p-6"
                  sizes="(max-width: 768px) 100vw, 380px"
                />
              </div>

              <div className="flex flex-col gap-6">
                <div>
                  <span className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium rounded-full mb-4">
                    In-person hackathon · 50 spots
                  </span>
                  <h3 className="text-xl md:text-2xl font-bold text-foreground mb-3">
                    {featuredHackathon.title}
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-300 text-base leading-relaxed">
                    {featuredHackathon.description}
                  </p>
                </div>

                <div className="space-y-3 text-neutral-600 dark:text-neutral-300 text-sm">
                  <p>
                    <span className="font-semibold text-foreground">When:</span>{" "}
                    {new Date(`${featuredHackathon.date}T12:00:00`).toLocaleDateString(
                      "en-US",
                      {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      }
                    )}
                    {featuredHackathon.time && featuredHackathon.time !== "TBD"
                      ? ` · ${featuredHackathon.time}`
                      : ""}
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">Where:</span>{" "}
                    {featuredHackathon.location}. Exact address on Luma after approval.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="px-2 py-1 bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs rounded-full border border-neutral-300 dark:border-neutral-700">
                      $50 Cursor Credits each
                    </span>
                    <span className="px-2 py-1 bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs rounded-full border border-neutral-300 dark:border-neutral-700">
                      $1,200 prize pool
                    </span>
                    <span className="px-2 py-1 bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs rounded-full border border-neutral-300 dark:border-neutral-700">
                      Food &amp; drinks
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href={getLumaCheckoutHref(featuredHackathon)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Register for Hack-a-Sprint on Luma (opens in new tab)"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-emerald-500 text-white rounded-lg text-base font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background w-full sm:w-auto luma-checkout--button"
                    data-luma-action="checkout"
                    data-luma-event-id={getLumaCheckoutEventId(featuredHackathon)}
                  >
                    Register for event
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
                    href="/hackathons"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 border border-neutral-300 dark:border-neutral-700 text-foreground rounded-lg text-base font-semibold hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background w-full sm:w-auto"
                  >
                    More details
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

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
                className={`rounded-xl p-5 border transition-all ${audienceCardColors[card.accent]}`}
              >
                <div className="mb-4">{card.icon}</div>
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
            <DiscordIcon size={24} />
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
            className="inline-flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-emerald-500 text-white rounded-lg text-base font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
              aria-hidden="true"
            >
              <path d="M7 17l9.2-9.2M17 17V7H7" />
            </svg>
          </a>
        </div>
      </section>
    </div>
  );
}
