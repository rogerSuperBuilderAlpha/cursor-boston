/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";
import Link from "next/link";
import eventsData from "@/content/events.json";
import {
  EventMapExplorer,
  EventMapExplorerSummary,
} from "@/components/events/EventMapExplorer";
import { getEventMapMarkers } from "@/lib/events-map";
import type { EventsData } from "@/types/events";

export const metadata: Metadata = {
  title: "Event Map",
  description:
    "Interactive map of Cursor Boston community events across the Boston area, with an accessible list view of every venue.",
  alternates: {
    canonical: "https://cursorboston.com/events/map",
  },
};

const typedEventsData = eventsData as unknown as EventsData;

const allEvents = [
  ...typedEventsData.upcoming,
  ...typedEventsData.past,
  ...(typedEventsData.oldEvents ?? []),
];

export default function EventMapPage() {
  const markers = getEventMapMarkers(allEvents);

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <nav
        aria-label="Breadcrumb"
        className="border-b border-neutral-200 bg-white px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <ol className="mx-auto flex max-w-6xl items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
          <li>
            <Link href="/events" className="hover:text-foreground">
              Events
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground">Map</li>
        </ol>
      </nav>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-950 dark:text-white md:text-5xl">
            Event Map
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-neutral-700 dark:text-neutral-300">
            See where Cursor Boston meets across Cambridge and Boston. Pin colors mark upcoming
            (blue) and past (gray) events — select a list item to focus the map.
          </p>
        </header>

        <EventMapExplorerSummary
          eventCount={allEvents.length}
          mappableCount={markers.length}
        />

        <EventMapExplorer events={allEvents} />
      </div>
    </main>
  );
}
