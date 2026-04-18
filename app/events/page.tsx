/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Metadata } from "next";
import Link from "next/link";
import eventsData from "@/content/events.json";
import { EventsBrowse } from "@/components/events/EventsBrowse";
import { todayYmdInListingTz } from "@/lib/events-calendar-buckets";
import { EventsData } from "@/types/events";

export const dynamic = "force-dynamic";

const typedEventsData = eventsData as unknown as EventsData;

const allListingEvents = [
  ...typedEventsData.upcoming,
  ...typedEventsData.past,
  ...(typedEventsData.oldEvents ?? []),
];

export const metadata: Metadata = {
  title: "Events",
  description:
    "Upcoming and past Cursor Boston events. Workshops, meetups, hackathons, and more for the Boston AI development community.",
  alternates: {
    canonical: "https://cursorboston.com/events",
  },
};

// Generate JSON-LD structured data for events
function generateEventsJsonLd() {
  const events = typedEventsData.upcoming.map((event) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description,
    startDate: event.date,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: event.location,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Boston",
        addressRegion: "MA",
        addressCountry: "US",
      },
    },
    organizer: {
      "@type": "Organization",
      name: "Cursor Boston",
      url: "https://cursorboston.com",
    },
    image: `https://cursorboston.com${event.image}`,
    url: `https://cursorboston.com/events/${event.slug}`,
  }));
  return events;
}

const eventTypes = [
  {
    name: "Workshops",
    description: "Hands-on sessions learning Cursor features and workflows",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    name: "Meetups",
    description: "Networking, demos, and community discussions",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    name: "Hackathons",
    description: "Build projects with AI-powered development tools",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    name: "University Sessions",
    description: "Campus events at MIT, Harvard, Hult, and more",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    ),
  },
];

export default function EventsPage() {
  const listingTodayYmd = todayYmdInListingTz(new Date());
  const eventsJsonLd = generateEventsJsonLd();

  return (
    <main className="flex flex-col">
      {eventsJsonLd.map((event, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(event),
          }}
        />
      ))}
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Events
          </h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto mb-8">
            Join us for workshops, meetups, hackathons, and more. All skill
            levels welcome.
          </p>
          <a
            href="https://lu.ma/cursor-boston"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Subscribe on Luma (opens in new tab)"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white dark:bg-white dark:text-black rounded-lg text-sm font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black"
          >
            Subscribe on Luma
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
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

      {/* Event Types */}
      <section className="py-12 px-6 bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-6">
            Event Types
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {eventTypes.map((type) => (
              <div
                key={type.name}
                className="flex items-start gap-4 p-4 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800"
              >
                <div className="text-neutral-500 dark:text-neutral-400">{type.icon}</div>
                <div>
                  <h3 className="text-foreground font-medium mb-1">{type.name}</h3>
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm">{type.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Today / future / past (tabbed) */}
      <section className="py-16 px-6 bg-neutral-50 dark:bg-neutral-950">
        <EventsBrowse events={allListingEvents} listingTodayYmd={listingTodayYmd} />
      </section>

      {/* Submit Event CTA */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Want to Host an Event?
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            Have an idea for a Cursor workshop, meetup, or hackathon in Boston?
            We&apos;d love to help you make it happen.
          </p>
          <Link
            href="/events/request"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white dark:bg-white dark:text-black rounded-lg text-sm font-semibold hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black"
          >
            Submit an Event Idea
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>
    </main>
  );
}
